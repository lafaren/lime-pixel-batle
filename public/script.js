const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');

const SIZE = 1000;
let pixels = null;

// Настройки камеры
let scale = 1;
let offsetX = 0;
let offsetY = 0;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
}

function draw() {
    if (!pixels) return;

    // Очистка фона
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Чтобы пиксели были супер-четкими
    ctx.imageSmoothingEnabled = false;

    // Рисуем всё поле сразу как картинку (это максимально быстро)
    const imgData = ctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        imgData.data[i * 4] = pixels[i * 3];
        imgData.data[i * 4 + 1] = pixels[i * 3 + 1];
        imgData.data[i * 4 + 2] = pixels[i * 3 + 2];
        imgData.data[i * 4 + 3] = 255;
    }
    
    // Используем временный canvas для мгновенного вывода
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = SIZE;
    tempCanvas.height = SIZE;
    tempCanvas.getContext('2d').putImageData(imgData, 0, 0);
    
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
}

socket.on('init', (data) => {
    pixels = new Uint8Array(data);
    // Центрируем поле при первом входе
    scale = Math.min(canvas.width, canvas.height) / SIZE * 0.8;
    offsetX = (canvas.width - SIZE * scale) / 2;
    offsetY = (canvas.height - SIZE * scale) / 2;
    draw();
});

socket.on('update', ({ index, r, g, b }) => {
    if (pixels) {
        pixels[index * 3] = r;
        pixels[index * 3 + 1] = g;
        pixels[index * 3 + 2] = b;
        draw();
    }
});

// Управление
let isDragging = false;
let startX, startY;

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // ЛКМ - Рисуем
        const x = Math.floor((e.clientX - offsetX) / scale);
        const y = Math.floor((e.clientY - offsetY) / scale);
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
            const hex = colorPicker.value;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            socket.emit('pixel', { index: y * SIZE + x, r, g, b });
        }
    } else { // ПКМ - Двигаем
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
    const zoomSpeed = 1.2;
    const factor = e.deltaY > 0 ? 1 / zoomSpeed : zoomSpeed;
    
    // Зум в точку курсора
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    offsetX = mouseX - (mouseX - offsetX) * factor;
    offsetY = mouseY - (mouseY - offsetY) * factor;
    scale *= factor;
    
    draw();
}, { passive: false });

window.addEventListener('resize', resize);
canvas.oncontextmenu = (e) => e.preventDefault();
resize();
