/**
 * Apéro Quiz Game Manager
 * Gère les parties de quiz bar avec équipes et réponses mobiles
 * 
 * Structure: 5 séries de 10 questions = 50 questions total
 * Mode: Par équipe (1 téléphone = 1 équipe)
 * Types: QCM, Estimation, Texte libre, Date, Vrai/Faux
 */

class AperoGameManager {
    constructor() {
        this.rooms = new Map(); // Map<roomCode, AperoRoom>
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Créer une nouvelle salle de quiz
     */
    createRoom(hostId, quizId, quizData) {
        const roomCode = this.generateRoomCode();

        const room = {
            code: roomCode,
            hostId: hostId,
            quizId: quizId,
            quizData: quizData,          // { title, slides: [...] }
            teams: new Map(),             // Map<teamName, TeamData>
            gameState: 'LOBBY',           // LOBBY, PLAYING, QUESTION_ACTIVE, QUESTION_REVEAL, SERIES_END, GAME_END
            currentSlideIndex: 0,         // Index dans quizData.slides
            currentQuestionNumber: 0,     // Numéro de question (1, 2, 3...)
            questionStartTime: null,
            answers: new Map(),           // Map<teamName, AnswerData>
            settings: {
                pointsBase: 100,
                pointsBonusMax: 50,
                defaultTimer: 20
            }
        };

        this.rooms.set(roomCode, room);
        console.log(`[APERO] Room ${roomCode} created with quiz "${quizData?.title || 'Unknown'}"`);
        return roomCode;
    }

    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    /**
     * Une équipe rejoint la partie
     */
    joinRoom(roomCode, socketId, teamName) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        // Nettoyer le nom d'équipe
        teamName = teamName.trim();
        if (!teamName) return { error: 'Nom d\'équipe requis' };

        // Vérifier si l'équipe existe déjà (reconnexion)
        if (room.teams.has(teamName)) {
            const team = room.teams.get(teamName);
            team.socketId = socketId;
            team.disconnected = false;
            console.log(`[APERO] Team "${teamName}" reconnected to room ${roomCode}`);
            return {
                success: true,
                reconnected: true,
                team,
                gameState: room.gameState,
                currentSlide: room.currentSlideIndex
            };
        }

        // Nouvelle équipe
        const team = {
            name: teamName,
            socketId: socketId,
            totalScore: 0,
            answers: [],           // Historique des réponses
            currentAnswer: null,
            hasAnswered: false,
            disconnected: false,
            joinedAt: Date.now()
        };

        room.teams.set(teamName, team);
        console.log(`[APERO] Team "${teamName}" joined room ${roomCode}`);

        return { success: true, team, gameState: room.gameState };
    }

    /**
     * Démarrer le quiz
     */
    startGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };
        if (!room.quizData?.slides?.length) return { error: 'Aucun quiz chargé' };

        room.gameState = 'PLAYING';
        room.currentSlideIndex = 0;
        room.currentQuestionNumber = 0;

        // Reset les scores
        for (const team of room.teams.values()) {
            team.totalScore = 0;
            team.answers = [];
            team.currentAnswer = null;
            team.hasAnswered = false;
        }

        console.log(`[APERO] Game started in room ${roomCode}`);
        return { success: true, slide: room.quizData.slides[0] };
    }

    /**
     * Aller au slide suivant
     */
    nextSlide(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        room.currentSlideIndex++;

        if (room.currentSlideIndex >= room.quizData.slides.length) {
            return this.endGame(roomCode);
        }

        const slide = room.quizData.slides[room.currentSlideIndex];
        room.gameState = 'PLAYING';

        // Reset réponses pour le prochain slide
        room.answers.clear();
        for (const team of room.teams.values()) {
            team.currentAnswer = null;
            team.hasAnswered = false;
        }

        return {
            success: true,
            slideIndex: room.currentSlideIndex,
            slide
        };
    }

    /**
     * Aller au slide précédent
     */
    prevSlide(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        if (room.currentSlideIndex > 0) {
            room.currentSlideIndex--;
        }

        const slide = room.quizData.slides[room.currentSlideIndex];
        return { success: true, slideIndex: room.currentSlideIndex, slide };
    }

    /**
     * Aller à un slide spécifique
     */
    goToSlide(roomCode, slideIndex) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        if (slideIndex < 0 || slideIndex >= room.quizData.slides.length) {
            return { error: 'Index de slide invalide' };
        }

        room.currentSlideIndex = slideIndex;
        const slide = room.quizData.slides[slideIndex];

        // Reset réponses
        room.answers.clear();
        for (const team of room.teams.values()) {
            team.currentAnswer = null;
            team.hasAnswered = false;
        }

        return { success: true, slideIndex, slide };
    }

    /**
     * Activer une question (ouvrir les réponses)
     */
    openQuestion(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        const slide = room.quizData.slides[room.currentSlideIndex];
        if (!slide || slide.type === 'title' || slide.type === 'score') {
            return { error: 'Ce slide n\'est pas une question' };
        }

        room.currentQuestionNumber++;
        room.gameState = 'QUESTION_ACTIVE';
        room.questionStartTime = Date.now();
        room.answers.clear();

        for (const team of room.teams.values()) {
            team.currentAnswer = null;
            team.hasAnswered = false;
        }

        console.log(`[APERO] Question ${room.currentQuestionNumber} opened`);

        return {
            success: true,
            questionNumber: room.currentQuestionNumber,
            questionType: slide.questionType,
            timer: slide.timer || room.settings.defaultTimer
        };
    }

    /**
     * Équipe soumet sa réponse
     */
    submitAnswer(roomCode, teamName, answer) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };
        if (room.gameState !== 'QUESTION_ACTIVE') return { error: 'Question non active' };

        const team = room.teams.get(teamName);
        if (!team) return { error: 'Équipe introuvable' };
        if (team.hasAnswered) return { error: 'Déjà répondu' };

        team.currentAnswer = answer;
        team.hasAnswered = true;

        room.answers.set(teamName, {
            answer: answer,
            timestamp: Date.now(),
            responseTime: (Date.now() - room.questionStartTime) / 1000
        });

        const answeredCount = Array.from(room.teams.values()).filter(t => t.hasAnswered && !t.disconnected).length;
        const totalTeams = Array.from(room.teams.values()).filter(t => !t.disconnected).length;

        console.log(`[APERO] Team "${teamName}" answered (${answeredCount}/${totalTeams})`);

        return {
            success: true,
            answeredCount,
            totalTeams,
            allAnswered: answeredCount >= totalTeams
        };
    }

    /**
     * Fermer la question et calculer les scores
     */
    closeQuestion(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        room.gameState = 'QUESTION_REVEAL';

        const slide = room.quizData.slides[room.currentSlideIndex];
        const correctAnswer = slide.correctAnswer;
        const questionType = slide.questionType;

        const results = [];

        for (const [teamName, team] of room.teams) {
            if (team.disconnected) continue;

            const answerData = room.answers.get(teamName);
            let points = 0;
            let correct = false;
            let distance = null;

            if (answerData) {
                const evaluation = this.evaluateAnswer(
                    questionType,
                    answerData.answer,
                    correctAnswer,
                    answerData.responseTime,
                    slide.timer || room.settings.defaultTimer,
                    room.settings
                );

                points = evaluation.points;
                correct = evaluation.correct;
                distance = evaluation.distance;
            }

            team.totalScore += points;
            team.answers.push({
                questionNumber: room.currentQuestionNumber,
                answer: team.currentAnswer,
                correct,
                points,
                distance
            });

            results.push({
                teamName,
                answer: team.currentAnswer,
                correct,
                points,
                distance,
                totalScore: team.totalScore
            });
        }

        // Trier par score
        results.sort((a, b) => b.totalScore - a.totalScore);

        // Pour les questions estimation, bonus au plus proche
        if (questionType === 'estimation' || questionType === 'date') {
            this.applyEstimationBonus(results, room.settings);
        }

        console.log(`[APERO] Question ${room.currentQuestionNumber} closed. Correct: ${correctAnswer}`);

        return {
            success: true,
            correctAnswer,
            questionType,
            results,
            answerStats: this.getAnswerStats(room)
        };
    }

    /**
     * Évaluer une réponse selon le type de question
     */
    evaluateAnswer(questionType, answer, correctAnswer, responseTime, maxTime, settings) {
        let points = 0;
        let correct = false;
        let distance = null;

        switch (questionType) {
            case 'qcm':
            case 'truefalse':
                correct = answer?.toUpperCase() === correctAnswer?.toUpperCase();
                if (correct) {
                    points = settings.pointsBase;
                    // Bonus rapidité
                    const speedRatio = Math.max(0, 1 - (responseTime / maxTime));
                    points += Math.round(settings.pointsBonusMax * speedRatio);
                }
                break;

            case 'estimation':
                const numAnswer = parseFloat(answer);
                const numCorrect = parseFloat(correctAnswer);
                if (!isNaN(numAnswer) && !isNaN(numCorrect)) {
                    distance = Math.abs(numAnswer - numCorrect);
                    // Score basé sur la proximité (sera ajusté avec bonus après)
                    const maxDistance = Math.abs(numCorrect) * 2 || 1000;
                    const accuracy = Math.max(0, 1 - (distance / maxDistance));
                    points = Math.round(settings.pointsBase * accuracy);
                    correct = distance === 0;
                }
                break;

            case 'date':
                // Format attendu: YYYY-MM-DD ou juste année
                const dateAnswer = this.parseDate(answer);
                const dateCorrect = this.parseDate(correctAnswer);
                if (dateAnswer && dateCorrect) {
                    distance = Math.abs(dateAnswer - dateCorrect) / (1000 * 60 * 60 * 24); // Jours
                    if (distance === 0) {
                        points = settings.pointsBase + settings.pointsBonusMax;
                        correct = true;
                    } else if (distance <= 365) {
                        points = Math.round(settings.pointsBase * (1 - distance / 365));
                    }
                }
                break;

            case 'text':
                // Correspondance flexible (ignorer casse, accents, espaces)
                const normalizedAnswer = this.normalizeText(answer);
                const normalizedCorrect = this.normalizeText(correctAnswer);
                correct = normalizedAnswer === normalizedCorrect;
                if (correct) {
                    points = settings.pointsBase;
                    const speedRatio = Math.max(0, 1 - (responseTime / maxTime));
                    points += Math.round(settings.pointsBonusMax * speedRatio);
                }
                break;
        }

        return { points, correct, distance };
    }

    /**
     * Bonus pour les questions estimation (plus proche = bonus)
     */
    applyEstimationBonus(results, settings) {
        const validResults = results.filter(r => r.distance !== null);
        if (validResults.length === 0) return;

        // Trier par distance (plus proche en premier)
        validResults.sort((a, b) => a.distance - b.distance);

        // Bonus décroissant pour les 3 premiers
        const bonuses = [50, 30, 10];
        validResults.slice(0, 3).forEach((result, index) => {
            result.points += bonuses[index] || 0;
            result.bonus = bonuses[index] || 0;
        });
    }

    parseDate(dateStr) {
        if (!dateStr) return null;
        // Essayer différents formats
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.getTime();
        // Format année seule
        const year = parseInt(dateStr);
        if (!isNaN(year) && year > 1000 && year < 3000) {
            return new Date(year, 0, 1).getTime();
        }
        return null;
    }

    normalizeText(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Enlever accents
            .replace(/[^a-z0-9]/g, '')       // Garder que alphanum
            .trim();
    }

    /**
     * Obtenir les statistiques de réponses
     */
    getAnswerStats(room) {
        const slide = room.quizData.slides[room.currentSlideIndex];
        if (slide.questionType !== 'qcm') return null;

        const stats = { A: 0, B: 0, C: 0, D: 0 };
        for (const team of room.teams.values()) {
            if (team.disconnected || !team.currentAnswer) continue;
            const answer = team.currentAnswer.toUpperCase();
            if (stats.hasOwnProperty(answer)) {
                stats[answer]++;
            }
        }
        return stats;
    }

    /**
     * Obtenir le classement
     */
    getLeaderboard(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        const leaderboard = Array.from(room.teams.values())
            .filter(t => !t.disconnected)
            .map(t => ({
                name: t.name,
                totalScore: t.totalScore,
                correctAnswers: t.answers.filter(a => a.correct).length,
                totalAnswers: t.answers.length
            }))
            .sort((a, b) => b.totalScore - a.totalScore);

        return { success: true, leaderboard };
    }

    /**
     * Fin de partie
     */
    endGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        room.gameState = 'GAME_END';
        const leaderboard = this.getLeaderboard(roomCode);

        console.log(`[APERO] Game ended in room ${roomCode}`);

        return {
            success: true,
            gameOver: true,
            ...leaderboard
        };
    }

    /**
     * Redémarrer la partie
     */
    restartGame(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        room.gameState = 'LOBBY';
        room.currentSlideIndex = 0;
        room.currentQuestionNumber = 0;
        room.answers.clear();

        for (const team of room.teams.values()) {
            team.totalScore = 0;
            team.answers = [];
            team.currentAnswer = null;
            team.hasAnswered = false;
        }

        return { success: true };
    }

    /**
     * Supprimer une équipe/connexion
     */
    removeTeam(socketId) {
        for (const [code, room] of this.rooms) {
            if (room.hostId === socketId) {
                // Don't delete room immediately - give host time to reconnect
                console.log(`[APERO] Host disconnected from room ${code}, keeping room alive for 60s`);
                room.hostDisconnected = true;
                room.hostDisconnectedAt = Date.now();

                // Set timeout to delete room if host doesn't reconnect
                if (room.hostTimeout) clearTimeout(room.hostTimeout);
                room.hostTimeout = setTimeout(() => {
                    if (this.rooms.has(code) && this.rooms.get(code).hostDisconnected) {
                        console.log(`[APERO] Host didn't reconnect, deleting room ${code}`);
                        this.rooms.delete(code);
                    }
                }, 60000); // 60 seconds grace period

                return { roomCode: code, isHost: true, hostDisconnected: true };
            }

            for (const [teamName, team] of room.teams) {
                if (team.socketId === socketId) {
                    if (room.gameState !== 'LOBBY') {
                        team.disconnected = true;
                        return { roomCode: code, isHost: false, teamName, type: 'disconnected' };
                    }
                    room.teams.delete(teamName);
                    return { roomCode: code, isHost: false, teamName, type: 'left' };
                }
            }
        }
        return null;
    }

    /**
     * Reconnect host to existing room
     */
    reconnectHost(roomCode, newSocketId) {
        const room = this.rooms.get(roomCode);
        if (!room) return { error: 'Salon introuvable' };

        if (room.hostTimeout) clearTimeout(room.hostTimeout);
        room.hostId = newSocketId;
        room.hostDisconnected = false;
        console.log(`[APERO] Host reconnected to room ${roomCode}`);

        return {
            success: true,
            quiz: room.quizData,
            teams: Array.from(room.teams.values()).filter(t => !t.disconnected),
            gameState: room.gameState,
            currentSlideIndex: room.currentSlideIndex
        };
    }

    /**
     * Get room by code (for reconnection)
     */
    getRoomForHost(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return null;
        return {
            code: roomCode,
            quiz: room.quizData,
            teams: Array.from(room.teams.values()).filter(t => !t.disconnected),
            gameState: room.gameState
        };
    }

    getTeamsInRoom(roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room) return [];
        return Array.from(room.teams.values()).filter(t => !t.disconnected);
    }
}

module.exports = new AperoGameManager();
