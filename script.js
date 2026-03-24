let currentInput = "";
const decimalDisplay = document.getElementById('decimal-out');
const fractionDisplay = document.getElementById('fraction-out');
const equalBtn = document.querySelector('.btn.equal');

// Initialize Math.js with Fraction support
const m = math.create(math.all, { number: 'Fraction' });

function append(val) {
    const operators = ['+', '-', '*', '/', '%'];
    const isOperator = operators.includes(val);
    const lastChar = currentInput.slice(-1);
    const secondLastChar = currentInput.length > 1 ? currentInput.slice(-2, -1) : "";

    if (currentInput === "" && isOperator && val !== '-') return;

    if (isOperator && operators.includes(lastChar)) {
        if (val === '-' && lastChar !== '-') {
            // allow negative sign directly after a generic operator
        } else {
            if (operators.includes(secondLastChar)) {
                currentInput = currentInput.slice(0, -2) + val;
            } else {
                if (currentInput.length === 1 && val !== '-') return;
                currentInput = currentInput.slice(0, -1) + val;
            }
            updateUI(currentInput);
            return;
        }
    }

    if (val === '.') {
        const parts = currentInput.split(/[\+\-\*\/\%\(\)]/);
        if (parts.pop().includes('.')) return;
    }

    currentInput += val;
    updateUI(currentInput);
}

function handleParentheses() {
    const openCount = (currentInput.match(/\(/g) || []).length;
    const closeCount = (currentInput.match(/\)/g) || []).length;
    const lastChar = currentInput.slice(-1);

    if (openCount > closeCount && (!isNaN(lastChar) || lastChar === ')')) {
        currentInput += ")";
    } else {
        currentInput += "(";
    }
    updateUI(currentInput);
}

function clearAll() {
    currentInput = "";
    decimalDisplay.classList.remove('error-text');
    updateUI("0");
    fractionDisplay.innerText = "";
}

function backspace() {
    currentInput = currentInput.slice(0, -1);
    updateUI(currentInput || "0");
    if (!currentInput) fractionDisplay.innerText = "";
}

function formatNumbers(str) {
    let result = "";
    let currentNum = "";
    for (let char of str) {
        if (/[0-9\.]/.test(char)) {
            currentNum += char;
        } else {
            if (currentNum) {
                const parts = currentNum.split('.');
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                result += parts.join('.');
                currentNum = "";
            }
            result += char;
        }
    }
    if (currentNum) {
        const parts = currentNum.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        result += parts.join('.');
    }
    return result;
}

function updateUI(val) {
    decimalDisplay.classList.remove('error-text');
    const formatted = formatNumbers(val);
    decimalDisplay.innerText = formatted.replace(/\*/g, '×').replace(/\//g, '÷');
    fractionDisplay.innerText = "";
    adjustFontSize();

    // Auto scroll right smoothly whenever text dynamically exceeds widths
    setTimeout(() => {
        decimalDisplay.scrollTo({ left: decimalDisplay.scrollWidth, behavior: 'smooth' });
    }, 0);
}

function adjustFontSize() {
    const len = decimalDisplay.innerText.length;
    if (len < 9) {
        decimalDisplay.style.fontSize = 'clamp(2.5rem, 12vw, 4rem)';
    } else if (len < 13) {
        decimalDisplay.style.fontSize = 'clamp(2rem, 10vw, 3rem)';
    } else if (len < 17) {
        decimalDisplay.style.fontSize = 'clamp(1.5rem, 8vw, 2.2rem)';
    } else {
        decimalDisplay.style.fontSize = 'clamp(1rem, 6vw, 1.5rem)';
    }

    const fracLen = fractionDisplay.innerText.length;
    if (fracLen < 25) {
        fractionDisplay.style.fontSize = '1.15rem';
    } else {
        fractionDisplay.style.fontSize = '0.9rem';
    }
}

// Check if decimal has repeating digit '3' for recurring decimals (basic approach)
function isRecurringThree(num) {
    const str = num.toString();
    if (!str.includes('.')) return false;
    const decimalPart = str.split('.')[1];
    if (decimalPart.length < 6) return false;
    return /33{4,}$/.test(decimalPart);  // last 5 or more digits are '3'
}

// Wrapped your logic inside this function header
function calculate() {
    if (!currentInput) return;

    // "Silent Return" if expression is incomplete (ends in operator, dot, or open bracket)
    const incompleteRegex = /[+\-*/%(\.]$|^$/;
    if (incompleteRegex.test(currentInput)) return;

    const openCount = (currentInput.match(/\(/g) || []).length;
    const closeCount = (currentInput.match(/\)/g) || []).length;
    if (openCount > closeCount) {
        currentInput += ")".repeat(openCount - closeCount);
    }

    try {
        const rawResult = m.evaluate(currentInput);
        let dec;
        try {
            dec = math.number(rawResult);
        } catch (e) {
            dec = parseFloat(rawResult);
        }

        if (isNaN(dec) || !isFinite(dec)) throw new Error("DivideByZero");

        // Clean floating-point noise (e.g. 96.04000000000001 → 96.04)
        const cleanDec = parseFloat(dec.toPrecision(12));
        const decStr = cleanDec.toString();
        const decimalPart = decStr.includes('.') ? decStr.split('.')[1] : "";

        if (Math.abs(dec) >= 1e12 || (Math.abs(dec) > 0 && Math.abs(dec) < 1e-7)) {
            decimalDisplay.innerText = dec.toExponential(5).toUpperCase().replace('E+', 'E');
        } else if (Number.isInteger(dec) || decimalPart.length <= 5) {
            decimalDisplay.innerText = formatNumbers(decStr);
        } else if (isRecurringThree(dec)) {
            decimalDisplay.innerText = formatNumbers(dec.toFixed(3)) + '...';
        } else {
            decimalDisplay.innerText = formatNumbers(dec.toFixed(5)) + '...';
        }

        // fractions fail on immense sizes
        try {
            const resultFraction = m.fraction(rawResult);
            // Hide if numerator or denominator is too large (8 digits cap)
            if (resultFraction.d && resultFraction.d !== 1 &&
                Math.abs(resultFraction.n) <= 99999999 &&
                Math.abs(resultFraction.d) <= 99999999) {
                fractionDisplay.innerText = `${resultFraction.n} / ${resultFraction.d}`;
            } else {
                fractionDisplay.innerText = "";
            }
        } catch (err) {
            fractionDisplay.innerText = "";
        }

        adjustFontSize();
    } catch (e) {
        decimalDisplay.classList.add('error-text');
        if (e.message === "DivideByZero" || (e.message && e.message.toLowerCase().includes('zero'))) {
            decimalDisplay.innerText = "Can't divide by 0";
        } else if (currentInput.match(/\/0(?!\.)/)) {
            decimalDisplay.innerText = "Can't divide by 0";
        } else {
            decimalDisplay.innerText = "Error";
        }
        adjustFontSize();
    }
}

// Global haptic feedback on Android! 
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (navigator.vibrate) {
            navigator.vibrate(15);
        }
    });
});

// Inner glow tap effect (exempt AC and =)
document.querySelectorAll('.btn:not(.ac):not(.equal)').forEach(btn => {
    const addTap = () => {
        btn.style.transition = 'none';
        btn.classList.add('tapped');
    };
    const removeTap = () => {
        btn.style.transition = '';
        btn.classList.remove('tapped');
    };
    btn.addEventListener('touchstart', addTap, { passive: true });
    btn.addEventListener('mousedown', addTap);
    btn.addEventListener('touchend', removeTap, { passive: true });
    btn.addEventListener('mouseup', removeTap);
});

// Display interaction (Swipe to delete & Long press to copy)
const displayContainer = document.querySelector('.display');
let touchStartX = 0;
let touchTimer;

displayContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchTimer = setTimeout(() => {
        if (navigator.clipboard) {
            const cleanText = decimalDisplay.innerText.replace(/,/g, '');
            navigator.clipboard.writeText(cleanText).then(() => {
                if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
                decimalDisplay.style.color = '#4cd964';
                setTimeout(() => decimalDisplay.style.color = '', 300);
            }).catch(() => { });
        }
    }, 600);
}, { passive: true });

displayContainer.addEventListener('touchend', (e) => {
    clearTimeout(touchTimer);
    const touchEndX = e.changedTouches[0].screenX;
    if (Math.abs(touchEndX - touchStartX) > 40) {
        if (navigator.vibrate) navigator.vibrate(15);
        backspace();
    }
}, { passive: true });

displayContainer.addEventListener('touchmove', () => {
    clearTimeout(touchTimer);
}, { passive: true });

// CE Hold-to-AC functionality
const btnCE = document.getElementById('btn-ce');
if (btnCE) {
    let ceFired = false;
    let ceDurTimer;

    const startCE = (e) => {
        e.preventDefault();
        ceFired = false;
        if (navigator.vibrate) navigator.vibrate(15);

        ceDurTimer = setTimeout(() => {
            clearAll();
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
            ceFired = true;
        }, 500);
    };

    const endCE = (e) => {
        e.preventDefault();
        clearTimeout(ceDurTimer);
        if (!ceFired) {
            backspace();
        }
    };

    btnCE.addEventListener('touchstart', startCE, { passive: false });
    btnCE.addEventListener('touchend', endCE, { passive: false });
    btnCE.addEventListener('touchcancel', () => clearTimeout(ceDurTimer));

    btnCE.addEventListener('mousedown', startCE);
    btnCE.addEventListener('mouseup', endCE);
    btnCE.addEventListener('mouseleave', () => clearTimeout(ceDurTimer));
}

// Advanced Proximity Lighting Logic (Vacuum Model)
const buttons = Array.from(document.querySelectorAll('.btn'));
buttons.forEach((btn, index) => {
    const startLight = () => {
        const row = Math.floor(index / 4);
        const col = index % 4;
        const color = getComputedStyle(btn).getPropertyValue('--glow-color').trim() || 'rgba(255, 255, 255, 0.3)';

        buttons.forEach((other, otherIdx) => {
            if (other === btn) return;
            const oRow = Math.floor(otherIdx / 4);
            const oCol = otherIdx % 4;
            const dx = oCol - col;
            const dy = oRow - row;

            // Only illuminate immediate neighbors (including diagonals) or the button itself
            if (other === btn) {
                // Kill transition for instant-on flash
                other.style.transition = 'none';

                if (btn.classList.contains('ac') || btn.classList.contains('equal')) {
                    const shadow = `inset 0 0 15px 0px ${color}, inset 0 0 0 transparent`;
                    other.style.setProperty('--prox-glow', shadow);
                } else {
                    // High Intensity but with the original lower opacity
                    const shadow = `inset 0 0 60px 20px ${color}, inset 0 0 15px 0px ${color}`;
                    other.style.setProperty('--prox-glow', shadow);
                }
                return;
            }

            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                let intensityX = 0;
                let intensityY = 0;
                if (dx !== 0 && dy !== 0) {
                    intensityX = dx * 2;
                    intensityY = dy * 2;
                } else {
                    intensityX = dx * 4;
                    intensityY = dy * 4;
                }

                // Use original color for neighbor glints
                const shadow = `inset ${intensityX}px ${intensityY}px 5px 0px ${color}, inset 0 0 0 transparent`;
                other.style.transition = 'none';
                other.style.setProperty('--prox-glow', shadow);
            }
        });
    };

    const stopLight = () => {
        buttons.forEach(other => {
            other.style.transition = '';
            // Reset to 2 layers to match the active state for a smooth 1.2s fade
            other.style.setProperty('--prox-glow', 'inset 0 0 0 transparent, inset 0 0 0 transparent');
        });
    };

    btn.addEventListener('touchstart', startLight, { passive: true });
    btn.addEventListener('mousedown', startLight);
    btn.addEventListener('touchend', stopLight, { passive: true });
    btn.addEventListener('mouseup', stopLight);
    btn.addEventListener('mouseleave', stopLight);
    btn.addEventListener('touchcancel', stopLight, { passive: true });
})