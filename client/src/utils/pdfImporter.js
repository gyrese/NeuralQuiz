import * as pdfjsLib from 'pdfjs-dist';
// Import worker as a URL to handle it correctly with Vite
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function convertPdfToQuiz(file) {
    const arrayBuffer = await file.arrayBuffer();

    // Load document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const slides = [];

    console.log(`[PDF IMPORT] Converting ${pdf.numPages} pages...`);

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Scale: ajuster pour avoir une qualité correcte sans exploser la taille
        // HD (1920x1080) approx.
        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // Compression JPEG 0.7 pour optimiser la taille
        const imageData = canvas.toDataURL('image/jpeg', 0.7);

        // Clean up
        canvas.width = 0;
        canvas.height = 0;

        // Créer un slide
        slides.push({
            id: crypto.randomUUID(), // Utilisation de crypto natif
            type: 'question', // On met question par défaut pour pouvoir jouer
            title: `Slide ${i}`,
            questionText: 'Question...', // Placeholder minimal
            questionType: 'qcm',
            options: [
                { label: 'A', text: 'Option A' },
                { label: 'B', text: 'Option B' }
            ],
            correctAnswer: 'A',
            // L'image de fond est l'essentiel du slide
            background: {
                type: 'image',
                value: imageData,
                opacity: 1
            },
            theme: 'dark' // Thème par défaut
        });
    }

    return {
        title: file.name.replace(/\.[^/.]+$/, "") + " (Import)",
        description: `Quiz importé depuis un PDF (${pdf.numPages} slides)`,
        slides,
        questions: [], // Ancien format, au cas où
        slideCount: slides.length,
        questionCount: slides.length
    };
}
