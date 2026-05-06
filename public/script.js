const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Отключаем прозрачность для скорости
const colorPicker = document.getElementById('colorPicker');

const SIZE = 1000;
let pixels = new Uint8Array(SIZE * SIZE * 3);

// Настройки камеры
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Создаем "оффскрин" холст ОДИН раз, чтобы не нагружать память
const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = SIZE;
offscreenCanvas.height = SIZE;
const offCtx = offscreenCanvas.getContext('2d', { alpha: false });

function updateOffscreen() {
    const imgData = offCtx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        imgData.data[i4] = pixels[i3];
        imgData.data[i4 + 1] = pixels[i3 + 1];
        imgData.data[i4 + 2] = pixels[i3 + 2];
        imgData.data[i4 + 3] = 255;
    }
    offCtx.putImageData(imgData, 0, 0);
}

function draw() {
    // Чистим основной холст
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // ВАЖНО: Отключаем сглаживание ПЕРЕД отрисовкой
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    // Рисуем заранее подготовленный холст
    ctx.drawImage(offscreenCanvas, 0, 0);
    
    ctx.restore();
}

socket.on('init', (data) => {
    pixels = new Uint8Array(data);
    updateOffscreen(); // Генерируем картинку
    
    // Авто-центрирование
    scale = Math.min(window.innerWidth, window.innerHeight) / SIZE * 0.8;
    offsetX = (window.innerWidth - SIZE * scale) / 2;
    offsetY = (window.innerHeight - SIZE * scale) / 2;
    draw();
});

socket.on('update', ({ index, r, g, b }) => {
    const i3 = index * 3;
    pixels[i3] = r;
    pixels[i3 + 1] = g;
    pixels[i3 + 2] = b;
    
    // Обновляем только один пиксель на оффскрин холсте (супер-быстро)
    offCtx.fillStyle = `rgb(${r},${g},${b})`;
    offCtx.fillRect(index % SIZE, Math.floor(index / SIZE), 1, 1);
    
    draw();
});

// --- УПРАВЛЕНИЕ (без изменений, но с фиксом зума) ---

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
}

window.addEventListener('resize', resize);
resize();

let isDragging = false;
let startX, startY;

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        const x = Math.floor((e.clientX - offsetX) / scale);
        const y = Math.floor((e.clientY - offsetY) / scale);
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
            const hex = colorPicker.value;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            socket.emit('pixel', { index: y * SIZE + x, r, g, b });
        }
    } else {
        isDragging = true;
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;
    }
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        offsetX = e.clientX - startX;
        offsetY = e.clientY - startY;
        draw();
    }
});

window.addEventListener('mouseup', () => isDragging = false);

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.8 : 1.2;
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // Зум к курсору
    offsetX = mouseX - (mouseX - offsetX) * factor;
    offsetY = mouseY - (mouseY - offsetY) * factor;
    scale *= factor;
    
    // Ограничения
    if (scale < 0.1) scale = 0.1;
    if (scale > 100) scale = 100;

    draw();
}, { passive: false });

canvas.oncontextmenu = (e) => e.preventDefault();
