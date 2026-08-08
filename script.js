// 颜色配置
const COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#FF69B4',
    '#00CED1', '#FF8C00', '#FFD700', '#FF4500',
    '#000000', '#333333', '#666666', '#999999',
    '#CCCCCC', '#FFFFFF', '#E74C3C', '#3498DB'
];

// 当前选中的颜色
let currentColor = '#FF6B6B';
// 是否处于橡皮擦模式
let isEraseMode = false;
// 是否正在绘制
let isDrawing = false;
// 网格大小
let gridSize = 15;

// DOM元素
const colorGrid = document.getElementById('colorGrid');
const colorPreview = document.getElementById('colorPreview');
const pixelGrid = document.getElementById('pixelGrid');
const gridSizeSelect = document.getElementById('gridSize');
const clearBtn = document.getElementById('clearBtn');
const fillBtn = document.getElementById('fillBtn');
const eraseBtn = document.getElementById('eraseBtn');

// 初始化颜色选择区
function initColorGrid() {
    colorGrid.innerHTML = '';
    COLORS.forEach(color => {
        const colorBlock = document.createElement('div');
        colorBlock.className = 'color-block';
        colorBlock.style.backgroundColor = color;
        colorBlock.addEventListener('click', () => selectColor(color));
        colorGrid.appendChild(colorBlock);
    });
    // 默认选中第一个颜色
    selectColor(COLORS[0]);
}

// 选择颜色
function selectColor(color) {
    currentColor = color;
    colorPreview.style.backgroundColor = color;
    
    // 更新选中状态
    const colorBlocks = colorGrid.querySelectorAll('.color-block');
    colorBlocks.forEach(block => {
        block.classList.remove('selected');
        if (block.style.backgroundColor === color) {
            block.classList.add('selected');
        }
    });
    
    // 如果在橡皮擦模式，退出橡皮擦模式
    if (isEraseMode) {
        toggleEraseMode();
    }
}

// 生成像素网格
function generatePixelGrid(size) {
    pixelGrid.innerHTML = '';
    pixelGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    pixelGrid.style.gridTemplateRows = `repeat(${size}, 1fr)`;
    
    // 根据容器大小计算单元格尺寸
    const containerWidth = Math.min(500, window.innerWidth - 60);
    const cellSize = Math.floor((containerWidth - (size - 1) - 6) / size);
    
    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.className = 'pixel-cell';
        cell.style.width = `${cellSize}px`;
        cell.style.height = `${cellSize}px`;
        
        // 绑定事件
        cell.addEventListener('mousedown', () => startDrawing(cell));
        cell.addEventListener('mouseenter', () => draw(cell));
        cell.addEventListener('mouseup', stopDrawing);
        
        // 触摸事件支持
        cell.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrawing(cell);
        });
        cell.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (target && target.classList.contains('pixel-cell')) {
                draw(target);
            }
        });
        cell.addEventListener('touchend', stopDrawing);
        
        pixelGrid.appendChild(cell);
    }
}

// 开始绘制
function startDrawing(cell) {
    isDrawing = true;
    draw(cell);
}

// 绘制
function draw(cell) {
    if (isDrawing) {
        cell.style.backgroundColor = isEraseMode ? '#FFFFFF' : currentColor;
    }
}

// 停止绘制
function stopDrawing() {
    isDrawing = false;
}

// 清空画布
function clearCanvas() {
    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    cells.forEach(cell => {
        cell.style.backgroundColor = '#FFFFFF';
    });
}

// 填充全部
function fillCanvas() {
    const cells = pixelGrid.querySelectorAll('.pixel-cell');
    cells.forEach(cell => {
        cell.style.backgroundColor = currentColor;
    });
}

// 切换橡皮擦模式
function toggleEraseMode() {
    isEraseMode = !isEraseMode;
    eraseBtn.classList.toggle('active');
    
    if (isEraseMode) {
        eraseBtn.style.background = 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)';
        colorPreview.style.borderColor = '#e74c3c';
        colorPreview.innerHTML = '<span style="color:#e74c3c;font-weight:bold;font-size:12px">✕</span>';
    } else {
        eraseBtn.style.background = 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        colorPreview.style.borderColor = '#ddd';
        colorPreview.innerHTML = '';
    }
}

// 网格大小改变
function onGridSizeChange() {
    gridSize = parseInt(gridSizeSelect.value);
    generatePixelGrid(gridSize);
}

// 窗口大小改变时重新生成网格
function onWindowResize() {
    generatePixelGrid(gridSize);
}

// 初始化
function init() {
    initColorGrid();
    generatePixelGrid(gridSize);
    
    // 绑定事件
    clearBtn.addEventListener('click', clearCanvas);
    fillBtn.addEventListener('click', fillCanvas);
    eraseBtn.addEventListener('click', toggleEraseMode);
    gridSizeSelect.addEventListener('change', onGridSizeChange);
    window.addEventListener('resize', onWindowResize);
    
    // 全局鼠标/触摸事件
    document.addEventListener('mouseup', stopDrawing);
    document.addEventListener('touchend', stopDrawing);
}

// DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}