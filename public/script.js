const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const colorPicker = document.getElementById('colorPicker');

const SIZE = 1000;
let pixels = new Uint8Array(SIZE * SIZE * 3);

let scale = 0.5;
let offsetX = window.innerWidth / 2 - (SIZE * scale) / 2;
let offsetY = window.innerHeight / 2 - (SIZE * scale) / 2;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function draw() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Создаем ImageData для быстрой отрисовки миллиона пикселей
    const imgData = ctx.createImageData(SIZE, SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) {
        imgData.data[i * 4] = pixels[i * 3];     // R
        imgData.data[i * 4 + 1] = pixels[i * 3 + 1]; // G
        imgData.data[i * 4 + 2] = pixels[i * 3 + 2]; // B
        imgData.data[i * 4 + 3] = 255;               // A
    }
    
    // Отрисовка на временный холст для масштабирования
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = SIZE;
    tempCanvas.height = SIZE;
    tempCanvas.getContext('2d').putImageData(imgData, 0, 0);
    
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();
}

socket.on('init', (data) => {
    pixels = new Uint8Array(data);
    draw();
});

socket.on('update', ({ index, r, g, b }) => {
    pixels[index * 3] = r;
    pixels[index * 3 + 1] = g;
    pixels[index * 3 + 2] = b;
    draw();
});

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// Управление
let isDragging = false;
let lastX, lastY;

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        const x = Math.floor((e.clientX - offsetX) / scale);
        const y = Math.floor((e.clientY - offsetY) / scale);
        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
            const { r, g, b } = hexToRgb(colorPicker.value);
            socket.emit('pixel', { index: y * SIZE + x, r, g, b });
        }
    } else {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
    }
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        offsetX += e.clientX - lastX;
        offsetY += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        draw();
    }
});

window.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('wheel', (e) => {
    const zoomSpeed = 1.1;
    scale = e.deltaY > 0 ? scale / zoomSpeed : scale * zoomSpeed;
    scale = Math.max(0.1, Math.min(scale, 100));
    draw();
});
canvas.oncontextmenu = (e) => e.preventDefault();
