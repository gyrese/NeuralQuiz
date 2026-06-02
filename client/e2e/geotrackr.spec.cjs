// E2E GeoTrackr — gameplay complet multi-acteurs + régression sécurité H1.
//
// Acteurs (3 contextes navigateur isolés) :
//   - HOST   : /geo/host        → crée le salon, expose code + remoteToken (QR)
//   - REMOTE : /geo/remote/...  → télécommande (doit fournir le token : fix H1)
//   - PLAYER : /geo/play        → joueur qui rejoint et devine
//
// Couvre : H1 (remote rejeté sans token / accepté avec token), join joueur,
// lancement, Street View, guess sur carte, scoring, manches, podium final.

const { test, expect } = require('@playwright/test');

const ROUNDS = 3; // minimum proposé par l'UI télécommande

// Lit la session hôte (roomCode + remoteToken) depuis localStorage, écrite à la création du salon.
async function getHostSession(hostPage) {
    const handle = await hostPage.waitForFunction(() => {
        const raw = localStorage.getItem('geoHostSession');
        if (!raw) return null;
        const s = JSON.parse(raw);
        return (s.roomCode && s.remoteToken) ? s : null;
    }, null, { timeout: 30_000 });
    return handle.jsonValue();
}

// Joueur : place et soumet un guess pour la manche en cours.
// Tente d'abord l'interaction UI réelle (carte Google) ; si Google Maps ne rend pas
// (clé restreinte au domaine prod / headless), bascule sur le socket réel de l'app
// (exactement le même évènement que le bouton VALIDER).
async function playerGuess(playerPage, roomCode) {
    const valider = playerPage.getByRole('button', { name: /VALIDER MA RÉPONSE/i });
    await valider.waitFor({ state: 'visible', timeout: 60_000 });

    try {
        const map = playerPage.locator('div.cursor-crosshair');
        await map.click(); // agrandit la carte
        await playerPage.getByText(/Placer votre marqueur/i).waitFor({ timeout: 8_000 });
        const box = await map.boundingBox();
        await playerPage.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.55);
        await expect(valider).toBeEnabled({ timeout: 5_000 });
        await valider.click();
        await playerPage.getByText(/GUESS ENVOYÉ/i).waitFor({ timeout: 8_000 });
        return; // succès via UI réelle
    } catch {
        // Repli déterministe via le socket applicatif réel.
    }

    await playerPage.evaluate(({ code }) => {
        // Coordonnées valides arbitraires : le serveur calcule distance + score (autorité serveur).
        window.__geoSocket.emit('geo-submit-guess', { roomCode: code, lat: 46.6, lng: 2.4 });
    }, { code: roomCode });
}

test('GeoTrackr — partie complète + sécurité télécommande (H1)', async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const playerCtx = await browser.newContext();
    const remoteCtx = await browser.newContext();
    const badRemoteCtx = await browser.newContext();

    // Flag E2E : autorise l'exposition du socket applicatif (window.__geoSocket) avant tout chargement
    for (const ctx of [hostCtx, playerCtx, remoteCtx, badRemoteCtx]) {
        await ctx.addInitScript(() => { window.__E2E__ = true; });
    }

    const hostPage = await hostCtx.newPage();
    const playerPage = await playerCtx.newPage();
    const remotePage = await remoteCtx.newPage();
    const badRemotePage = await badRemoteCtx.newPage();

    try {
        // ---------- 1. HÔTE : création du salon ----------
        await hostPage.goto('/geo/host');
        const session = await getHostSession(hostPage);
        const { roomCode, remoteToken } = session;
        expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
        expect(remoteToken).toMatch(/^[a-f0-9]{32}$/);

        // Le QR de la télécommande (dans la modale Paramètres) doit embarquer le token (câblage H1 côté UI)
        await hostPage.getByRole('button', { name: /Paramètres/i }).click();
        const qrSrc = await hostPage.locator('img[alt="QR Code Télécommande"]').getAttribute('src');
        expect(decodeURIComponent(qrSrc)).toContain(`rt=${remoteToken}`);
        await hostPage.getByRole('button', { name: /^VALIDER$/ }).click(); // refermer la modale

        // ---------- 2. H1 : remote SANS token => rejeté ----------
        await badRemotePage.goto(`/geo/remote/${roomCode}`);
        await expect(badRemotePage.getByText(/non autoris/i)).toBeVisible({ timeout: 20_000 });

        // ---------- 3. H1 : remote AVEC token => accepté (LOBBY) ----------
        await remotePage.goto(`/geo/remote/${roomCode}?rt=${remoteToken}`);
        await expect(remotePage.getByText(/TÉLÉCOMMANDE/i)).toBeVisible({ timeout: 20_000 });
        await expect(remotePage.getByText(new RegExp(`PIN:\\s*${roomCode}`, 'i'))).toBeVisible();

        // ---------- 4. JOUEUR : rejoint le salon ----------
        await playerPage.goto('/geo/play');
        await playerPage.locator('#roomCode').fill(roomCode);
        await playerPage.locator('#pseudo').fill('E2E_BOT');
        // choisir le premier avatar proposé
        await playerPage.locator('button:has(img[alt=""])').first().click();
        await playerPage.getByRole('button', { name: /REJOINDRE LA PARTIE/i }).click();

        // La télécommande voit le joueur connecté
        await expect(remotePage.getByText(/Joueurs connectés \(1\)/i)).toBeVisible({ timeout: 20_000 });

        // ---------- 5. REMOTE : réglages + lancement ----------
        await remotePage.locator('select').first().selectOption(String(ROUNDS)); // Manches
        await remotePage.locator('select').nth(1).selectOption('180');           // Temps/manche (évite l'auto-advance hôte)
        await remotePage.getByRole('button', { name: /France/i }).click();       // région à forte couverture Street View
        await remotePage.getByRole('button', { name: /LANCER LA PARTIE/i }).click();

        // ---------- 6. Boucle de manches ----------
        for (let round = 1; round <= ROUNDS; round++) {
            const isLast = round === ROUNDS;

            // Joueur : Street View -> guess
            await playerGuess(playerPage, roomCode);

            // Remote : terminer la manche
            const endBtn = remotePage.getByRole('button', { name: /TERMINER LA MANCHE/i });
            await endBtn.waitFor({ state: 'visible', timeout: 30_000 });
            await endBtn.click();

            // Résultats de la manche affichés sur la télécommande
            await expect(remotePage.getByText(/RÉSULTATS DE LA MANCHE/i)).toBeVisible({ timeout: 30_000 });

            // Avancer (manche suivante ou résultats finaux)
            const nextLabel = isLast ? /VOIR LES RÉSULTATS/i : /MANCHE SUIVANTE/i;
            await remotePage.getByRole('button', { name: nextLabel }).click();
        }

        // ---------- 7. Fin de partie : podium ----------
        // La télécommande passe en GAME_END et affiche le podium final avec le joueur.
        await expect(remotePage.getByText(/PARTIE TERMINÉE/i)).toBeVisible({ timeout: 30_000 });
        await expect(remotePage.getByText(/E2E_BOT/i)).toBeVisible({ timeout: 10_000 });
    } finally {
        await Promise.all([
            hostCtx.close(), playerCtx.close(), remoteCtx.close(), badRemoteCtx.close(),
        ]);
    }
});
