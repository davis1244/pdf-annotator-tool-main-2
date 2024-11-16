// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.14.305/pdf.worker.min.js';

const fileInput = document.getElementById('file-input');
const pdfContainer = document.getElementById('pdf-container');
const highlightBtn = document.getElementById('highlight-btn');
const commentBtn = document.getElementById('comment-btn');
const saveBtn = document.getElementById('save-btn');
const commentModal = document.getElementById('comment-modal');
const closeButton = document.querySelector('.close-button');
const saveCommentBtn = document.getElementById('save-comment-btn');
const commentText = document.getElementById('comment-text');

let pdfDoc = null;
let currentPage = 1;
let annotations = [];
let isHighlightMode = false;
let isCommentMode = false;
let isDrawing = false;
let startX, startY;
let currentAnnotation = null;

// Load saved annotations from localStorage
const loadSavedAnnotations = () => {
    const saved = localStorage.getItem('pdfAnnotations');
    if (saved) {
        annotations = JSON.parse(saved);
    }
};

// Save annotations to localStorage
const saveAnnotations = () => {
    localStorage.setItem('pdfAnnotations', JSON.stringify(annotations));
};

// Handle File Upload
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = function(ev) {
            const typedarray = new Uint8Array(ev.target.result);
            loadPDF(typedarray);
        };
        reader.readAsArrayBuffer(file);
        loadSavedAnnotations();
    } else {
        alert('Please upload a valid PDF file.');
    }
});

// Load PDF
async function loadPDF(data) {
    try {
        pdfDoc = await pdfjsLib.getDocument({data: data}).promise;
        pdfContainer.innerHTML = '';
        
        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const canvas = document.createElement('canvas');
            canvas.id = `page-${pageNum}`;
            canvas.className = 'pdf-page';
            pdfContainer.appendChild(canvas);
            
            const context = canvas.getContext('2d');
            const viewport = page.getViewport({scale: 1.5});
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
        }
        
        // Render saved annotations
        renderAllAnnotations();
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF file.');
    }
}

// Toggle Highlight Mode
highlightBtn.addEventListener('click', () => {
    isHighlightMode = !isHighlightMode;
    isCommentMode = false;
    highlightBtn.classList.toggle('active', isHighlightMode);
    commentBtn.classList.remove('active');
    pdfContainer.style.cursor = isHighlightMode ? 'crosshair' : 'default';
});

// Toggle Comment Mode
commentBtn.addEventListener('click', () => {
    isCommentMode = !isCommentMode;
    isHighlightMode = false;
    commentBtn.classList.toggle('active', isCommentMode);
    highlightBtn.classList.remove('active');
    pdfContainer.style.cursor = isCommentMode ? 'pointer' : 'default';
});

// Handle mouse events for highlighting
pdfContainer.addEventListener('mousedown', (e) => {
    if (!isHighlightMode || !pdfDoc) return;
    
    isDrawing = true;
    const rect = pdfContainer.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    currentAnnotation = document.createElement('div');
    currentAnnotation.className = 'highlight-area';
    currentAnnotation.style.left = `${startX}px`;
    currentAnnotation.style.top = `${startY}px`;
    pdfContainer.appendChild(currentAnnotation);
});

pdfContainer.addEventListener('mousemove', (e) => {
    if (!isDrawing || !currentAnnotation) return;
    
    const rect = pdfContainer.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const width = currentX - startX;
    const height = currentY - startY;
    
    currentAnnotation.style.width = `${Math.abs(width)}px`;
    currentAnnotation.style.height = `${Math.abs(height)}px`;
    currentAnnotation.style.left = `${width < 0 ? currentX : startX}px`;
    currentAnnotation.style.top = `${height < 0 ? currentY : startY}px`;
});

pdfContainer.addEventListener('mouseup', () => {
    if (!isDrawing || !currentAnnotation) return;
    
    isDrawing = false;
    const bounds = currentAnnotation.getBoundingClientRect();
    const pdfBounds = pdfContainer.getBoundingClientRect();
    
    // Only save if the highlight has a meaningful size
    if (bounds.width > 5 && bounds.height > 5) {
        annotations.push({
            type: 'highlight',
            x: (bounds.left - pdfBounds.left),
            y: (bounds.top - pdfBounds.top),
            width: bounds.width,
            height: bounds.height,
            page: getCurrentPage(bounds.top)
        });
        saveAnnotations();
    } else {
        currentAnnotation.remove();
    }
    
    currentAnnotation = null;
});

// Handle clicks for comments
pdfContainer.addEventListener('click', (e) => {
    if (!isCommentMode || !pdfDoc) return;
    
    const rect = pdfContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    openCommentModal(x, y);
});

// Get current page based on Y position
function getCurrentPage(y) {
    const pages = document.querySelectorAll('.pdf-page');
    let currentHeight = 0;
    
    for (let i = 0; i < pages.length; i++) {
        const pageHeight = pages[i].height;
        if (y <= currentHeight + pageHeight) {
            return i + 1;
        }
        currentHeight += pageHeight;
    }
    
    return pages.length;
}

// Comment Modal Functions
function openCommentModal(x, y) {
    commentModal.style.display = 'block';
    commentText.value = '';
    currentAnnotation = { x, y, page: getCurrentPage(y) };
}

closeButton.addEventListener('click', () => {
    commentModal.style.display = 'none';
    currentAnnotation = null;
});

saveCommentBtn.addEventListener('click', () => {
    const text = commentText.value.trim();
    if (!text || !currentAnnotation) return;
    
    const comment = {
        type: 'comment',
        x: currentAnnotation.x,
        y: currentAnnotation.y,
        text: text,
        page: currentAnnotation.page
    };
    
    annotations.push(comment);
    saveAnnotations();
    renderComment(comment);
    
    commentModal.style.display = 'none';
    currentAnnotation = null;
    commentText.value = '';
});

// Render Functions
function renderComment(comment) {
    const marker = document.createElement('div');
    marker.className = 'comment-marker';
    marker.textContent = '💬';
    marker.style.left = `${comment.x}px`;
    marker.style.top = `${comment.y}px`;
    
    const content = document.createElement('div');
    content.className = 'comment-content';
    content.textContent = comment.text;
    
    marker.appendChild(content);
    pdfContainer.appendChild(marker);
    
    marker.addEventListener('mouseenter', () => {
        content.style.display = 'block';
    });
    
    marker.addEventListener('mouseleave', () => {
        content.style.display = 'none';
    });
}

function renderHighlight(highlight) {
    const highlightEl = document.createElement('div');
    highlightEl.className = 'highlight-area';
    highlightEl.style.left = `${highlight.x}px`;
    highlightEl.style.top = `${highlight.y}px`;
    highlightEl.style.width = `${highlight.width}px`;
    highlightEl.style.height = `${highlight.height}px`;
    pdfContainer.appendChild(highlightEl);
}

function renderAllAnnotations() {
    annotations.forEach(annotation => {
        if (annotation.type === 'highlight') {
            renderHighlight(annotation);
        } else if (annotation.type === 'comment') {
            renderComment(annotation);
        }
    });
}

// Save annotations to server
saveBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        alert('Please upload a PDF file first.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('annotations', JSON.stringify(annotations));

    try {
        const response = await fetch('/save', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (data.success) {
            alert('Annotations saved successfully!');
        } else {
            alert('Failed to save annotations.');
        }
    } catch (error) {
        console.error('Error saving annotations:', error);
        alert('Error saving annotations.');
    }
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === commentModal) {
        commentModal.style.display = 'none';
        currentAnnotation = null;
    }
});