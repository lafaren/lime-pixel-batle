const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const colorPicker = document.getElementById('colorPicker');

const SIZE = 800; // Размер поля в пикселях
let pixels = Array(SIZE * SIZE).fill('#FFFFFF');

// Настройки камеры
let scale = 10;   // Текущий зум
let offsetX = 0;  // Смещение по X
let offsetY = 0;  // Смещение по Y

// Инициализация холста
canvas.width = window.innerWidth * 0.8;
canvas.height = window.innerHeight * 0.7;

function draw() {
    ctx.fillStyle = '#1a1a1a'; // Фон за пределами холста
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Рисуем все пиксели
    for (let i = 0; i < pixels.length; i++) {
        const x = i % SIZE;
        const y = Math.floor(i / SIZE);
        ctx.fillStyle = pixels[i];
        ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
}

// Получение данных от сервера
socket.on('init', (data) => {
    pixels = data;
    draw();
});

socket.on('update', ({ index, color }) => {
    pixels[index] = color;
    draw();
});

// ПРИБЛИЖЕНИЕ (Zoom)
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    scale *= delta;
    
    // Ограничение зума
    if (scale < 1) scale = 1;
    if (scale > 50) scale = 50;
    
    draw();
}, { passive: false });

// ПЕРЕМЕЩЕНИЕ И РИСОВАНИЕ
let isDragging = false;
let lastMouseX, lastMouseY;

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Левая кнопка - рисуем
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Вычисляем координаты пикселя с учетом зума и смещения
        const x = Math.floor((mouseX - offsetX) / scale);
        const y = Math.floor((mouseY - offsetY) / scale);

        if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
            const index = y * SIZE + x;
            const color = colorPicker.value;
            socket.emit('pixel', { index, color });
        }
    } else if (e.button === 2 || e.button === 1) { // Правая или средняя - двигаем
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        offsetX += e.clientX - lastMouseX;
        offsetY += e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        draw();
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

// Отключаем контекстное меню при клике правой кнопкой
canvas.oncontextmenu = (e) => e.preventDefault();

// Перерисовка при изменении окна
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth * 0.8;
    canvas.height = window.innerHeight * 0.7;
    draw();
});

