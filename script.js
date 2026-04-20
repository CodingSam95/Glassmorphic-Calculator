let currentInput = "";
let calcHistory = [];
const decimalDisplay = document.getElementById('decimal-out');
const fractionDisplay = document.getElementById('fraction-out');
const exprDisplay = document.getElementById('expr-out');
const livePreviewDisplay = document.getElementById('live-preview');
const equalBtn = document.querySelector('.btn.equal');

// Initialize Math.js with Fraction support
const m = math.create(math.all, { number: 'Fraction' });
// Remove E as a global constant so it doesn't conflict with scientific notation EXP key
if (m.E) delete m.E;
if (m.e && typeof m.E !== 'undefined') delete m.E; // handling different mathjs versions
// Ensure mathjs sees 'E' as scientific part of number, not the constant e.
// Standalone 'E' will now be undefined/error instead of 2.718...

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

    // Guard: Don't allow operators if expression ends with incomplete C or P
    if (isOperator && (lastChar === 'C' || lastChar === 'P')) return;

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
    exprDisplay.innerText = "";
}

document.getElementById('btn-ce').addEventListener('click', () => {
    backspace();
    if (navigator.vibrate) navigator.vibrate(12);
});

function backspace() {
    if (!currentInput) return;
    
    const funcs = ['asin(', 'acos(', 'atan(', 'sqrt(', 'cbrt(', 'log(', 'ln(', 'nthRoot(', 'sin(', 'cos(', 'tan(', '^2 ', '^3 '];
    const opTokens = ['C', 'P'];
    let deleted = false;
    
    for (const f of funcs) {
        if (currentInput.endsWith(f)) {
            currentInput = currentInput.slice(0, -f.length);
            deleted = true;
            break;
        }
    }
    
    if (!deleted) {
        for (const t of opTokens) {
            if (currentInput.endsWith(t)) {
                currentInput = currentInput.slice(0, -t.length);
                deleted = true;
                break;
            }
        }
    }
    
    if (!deleted) {
        currentInput = currentInput.slice(0, -1);
    }
    
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

function formatDisplayExpr(str) {
    if (!str) return "";
    let expr = formatNumbers(str)
        .replace(/\*/g, '×')
        .replace(/\//g, '÷');
    expr = expr.replace(/sqrt\(/g, '√(');
    expr = expr.replace(/cbrt\(/g, '∛(');
    expr = expr.replace(/nthRoot\(/g, 'ʸ√(');
    expr = expr.replace(/asin\(/g, 'arcsin(');
    expr = expr.replace(/acos\(/g, 'arccos(');
    expr = expr.replace(/atan\(/g, 'arctan(');
    expr = expr.replace(/nCr\(/g, 'nCr(');
    expr = expr.replace(/\^2/g, '²');
    expr = expr.replace(/\^3/g, '³');
    expr = expr.replace(/(\d)C(\d)/g, '$1C$2');
    expr = expr.replace(/(\d)P(\d)/g, '$1P$2');
    expr = expr.replace(/(\d)e([+-]?\d)/g, '$1E$2');
    expr = expr.replace(/E/g, 'E'); // Ensure literal E stays E
    expr = expr.replace(/pi/g, 'π');
    expr = expr.replace(/e/g, 'e');
    return expr;
}

let parenFlashTimer;


function updateUI(val) {
    decimalDisplay.classList.remove('error-text');
    
    let strToFormat = val;
    let formatted = formatDisplayExpr(strToFormat);
    
    decimalDisplay.innerHTML = formatted;
    fractionDisplay.innerText = "";
    exprDisplay.classList.remove('shown');
    adjustFontSize();

    // --- Live Preview Logic ---
    try {
        const incompleteRegex = /[+\-*/(\.]$|^$|[+\-*/]{2,}/;
        const isSimpleNumber = /^-?\d*\.?\d*$/.test(val.trim());
        
        if (!val || val === "0" || isSimpleNumber || incompleteRegex.test(val) || (val.match(/\(/g) || []).length !== (val.match(/\)/g) || []).length) {
            livePreviewDisplay.classList.remove('shown');
        } else {
            // Prepare string for a silent silent mathjs evaluate
            let sil = val.replace(/\barcsin\(/g, 'asin(').replace(/\barccos\(/g, 'acos(').replace(/\barctan\(/g, 'atan(');
            // Angle mode
            if (angleMode === 'deg') {
                sil = sil.replace(/\bsin\(/g, 'sin((pi/180)*').replace(/\bcos\(/g, 'cos((pi/180)*').replace(/\btan\(/g, 'tan((pi/180)*')
                         .replace(/\basin\(/g, '(180/pi)*asin(').replace(/\bacos\(/g, '(180/pi)*acos(').replace(/\batan\(/g, '(180/pi)*atan(');
            }
            // Basic % replacements for live feel
            sil = sil.replace(/([\d.]+)%/g, "($1/100)");

            const res = m.evaluate(sil);
            const num = math.number(res);
            if (isFinite(num) && !isNaN(num)) {
                const clean = parseFloat(num.toPrecision(10));
                // Omit trailing zeros and uppercase E
                const cleanStr = clean.toString().toUpperCase().replace('E+', 'E');
                livePreviewDisplay.innerText = formatNumbers(cleanStr);
                livePreviewDisplay.classList.add('shown');
            } else {
                livePreviewDisplay.classList.remove('shown');
            }
        }
    } catch (e) {
        livePreviewDisplay.classList.remove('shown');
    }

    setTimeout(() => {
        decimalDisplay.scrollTo({ left: decimalDisplay.scrollWidth, behavior: 'smooth' });
    }, 0);
}

function adjustFontSize() {
    const len = decimalDisplay.innerText.length;

    // Error messages should have a consistent, premium large font size
    if (decimalDisplay.classList.contains('error-text')) {
        decimalDisplay.style.fontSize = 'clamp(2rem, 10vw, 3rem)';
        const fracLenErr = fractionDisplay.innerText.length;
        fractionDisplay.style.fontSize = fracLenErr < 25 ? '1.15rem' : '0.9rem';
        return;
    }

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

// Generates string for recurring decimals using [brackets] for sequence
function getRecurringStr(dec, n, d) {
    if (d === 0 || !Number.isFinite(n) || !Number.isFinite(d)) return null;
    let n_abs = Math.abs(n);
    let d_abs = Math.abs(d);
    
    if (d_abs > 99999999) return null; // Fallback for massive fractions
    
    let intPart = Math.floor(n_abs / d_abs);
    let rem = n_abs % d_abs;
    
    if (rem === 0) return null; 
    
    let rems = new Map();
    let digits = "";
    let index = 0;
    
    while (rem !== 0 && !rems.has(rem) && index < 50) {
        rems.set(rem, index);
        rem *= 10;
        digits += Math.floor(rem / d_abs);
        rem %= d_abs;
        index++;
    }
    
    if (rem === 0) return null; 
    
    if (rems.has(rem)) {
        let repeatIndex = rems.get(rem);
        let nonRepeating = digits.substring(0, repeatIndex);
        let repeating = digits.substring(repeatIndex);
        
        if (repeating.length <= 6) {
            let sign = dec < 0 ? "-" : "";
            let formattedInt = formatNumbers(intPart.toString());
            return `${sign}${formattedInt}.${nonRepeating}[${repeating}]`;
        }
    }
    
    return null; 
}

// Wrapped your logic inside this function header
function calculate() {
    if (!currentInput) return;

    // "Silent Return" if expression is incomplete (ends in operator, dot, or open bracket)
    const incompleteRegex = /[+\-*/(\.]$|^$/;
    if (incompleteRegex.test(currentInput)) return;

    const openCount = (currentInput.match(/\(/g) || []).length;
    const closeCount = (currentInput.match(/\)/g) || []).length;
    if (openCount > closeCount) {
        currentInput += ")".repeat(openCount - closeCount);
    }

    try {
        let tempInput = currentInput;
        // Map display functions to math.js functions
        tempInput = tempInput.replace(/\barcsin\(/g, 'asin(')
                             .replace(/\barccos\(/g, 'acos(')
                             .replace(/\barctan\(/g, 'atan(');

        // 1. Handle + and - percentages (e.g., 100 + 10% => 100 * 1.1)
        tempInput = tempInput.replace(/([\d.]+|(\([\s\S]*?\)))\s*([\+\-])\s*([\d.]+)%/g, (match, p1, p2, op, p3) => {
            const factor = op === '+' ? (1 + p3 / 100) : (1 - p3 / 100);
            return `(${p1} * ${factor})`;
        });
        // 2. Handle * and / percentages (e.g., 100 * 10% => 100 * 0.1)
        tempInput = tempInput.replace(/([\*\/])\s*([\d.]+)%/g, (match, op, p2) => {
            return `${op}(${p2}/100)`;
        });
        // 3. Handle any remaining % (standalone or at start)
        tempInput = tempInput.replace(/([\d.]+)%/g, "($1/100)");

        // 4. Angle mode conversion for trig (wrap args in deg→rad conversion if in deg mode)
        if (angleMode === 'deg') {
            tempInput = tempInput
                .replace(/\bsin\(/g, 'sin((pi/180)*')
                .replace(/\bcos\(/g, 'cos((pi/180)*')
                .replace(/\btan\(/g, 'tan((pi/180)*')
                // inverse trig: asin/acos/atan return radians, convert to deg
                .replace(/\basin\(/g, '(180/pi)*asin(')
                .replace(/\bacos\(/g, '(180/pi)*acos(')
                .replace(/\batan\(/g, '(180/pi)*atan(');
        }

        // 5. nCr/nPr: "C" → combinations, "P" → permutations
        tempInput = tempInput.replace(/(\d+)\s*C\s*(\d+)/g, 'combinations($1, $2)');
        tempInput = tempInput.replace(/(\d+)\s*P\s*(\d+)/g, 'permutations($1, $2)');

        // 6. Factorial: n! → factorial(n)
        tempInput = tempInput.replace(/(\d+)!/g, 'factorial($1)');

        // 7. ln(x) → log(x, e)
        tempInput = tempInput.replace(/\bln\(/g, 'log(').replace(/,\s*e\)/g, ', e)');

        const rawResult = m.evaluate(tempInput);
        
        // Handle complex results
        const isComplex = rawResult && (rawResult.isComplex || (typeof math.typeOf === 'function' && math.typeOf(rawResult) === 'Complex'));
        if (isComplex && Math.abs(rawResult.im) > 1e-15) {
            // Specific Domain Errors for inverse trig, others get "Be Real"
            if (tempInput.includes('asin') || tempInput.includes('acos') || tempInput.includes('atan')) {
                throw new Error("Domain Error");
            }
            throw new Error("Be Real");
        }

        let dec;
        try {
            dec = math.number(rawResult);
        } catch (e) {
            dec = parseFloat(rawResult);
        }

        if (isNaN(dec)) throw new Error("Invalid Input");
        
        if (!isFinite(dec)) {
            // log(0) or ln(0) are Domain Errors
            // currentInput is used here to check the original function calls
            if (currentInput.match(/\blog\(|\bln\(|\blog10\(/)) {
                throw new Error("Domain Error");
            }
            // Explicit check for division by zero
            if (currentInput.match(/\/0(?!\.)/)) {
                throw new Error("DivideByZero");
            }
            throw new Error("Overload");
        }

        // Clean floating-point noise (e.g. 96.04000000000001 → 96.04)
        const cleanDec = parseFloat(dec.toPrecision(12));
        const decStr = cleanDec.toString();
        const decimalPart = decStr.includes('.') ? decStr.split('.')[1] : "";

        let resultStr = "";
        let recurringStr = null;
        try {
            const resultFraction = m.fraction(rawResult);
            // math.js Fraction has n, d
            recurringStr = getRecurringStr(dec, resultFraction.n, resultFraction.d);
        } catch(e) {}

        if (Math.abs(dec) >= 1e12 || (Math.abs(dec) > 0 && Math.abs(dec) < 1e-7)) {
            resultStr = dec.toExponential(5).replace(/\.?0+e/, 'e').toUpperCase().replace('E+', 'E');
        } else if (recurringStr) {
            resultStr = recurringStr;
        } else if (Number.isInteger(dec) || decimalPart.length <= 6) {
            resultStr = formatNumbers(decStr);
        } else {
            const cleanApprox = parseFloat(dec.toFixed(6)).toString();
            let approx = formatNumbers(cleanApprox) + '...';
            // Extract the clean full precision evaluation for the horizontal scroll reveal
            let cleanFull = parseFloat(dec.toPrecision(14)).toString().toUpperCase().replace('E+', 'E');
            let fullStr = formatNumbers(cleanFull);
            resultStr = `<span class="swipe-reveal" data-full="${fullStr}">${approx}</span>`;
        }

        // Apply bracket replacement
        decimalDisplay.innerHTML = resultStr.replace(/\[(.*?)\]/g, '<span class="overline">$1</span>');

        // Accurate Fraction Logic
        try {
            // We create a temporary math instance in Fraction mode to see if the result can be perfectly rationalized
            const fmath = math.create({ number: 'Fraction' });
            let fsil = tempInput.replace(/\barcsin\(/g, 'asin(').replace(/\barccos\(/g, 'acos(').replace(/\barctan\(/g, 'atan(');
            if (angleMode === 'deg') {
                fsil = fsil.replace(/\bsin\(/g, 'sin((pi/180)*').replace(/\bcos\(/g, 'cos((pi/180)*').replace(/\btan\(/g, 'tan((pi/180)*')
                           .replace(/\basin\(/g, '(180/pi)*asin(').replace(/\bacos\(/g, '(180/pi)*acos(').replace(/\batan\(/g, '(180/pi)*atan(');
            }
            fsil = fsil.replace(/([\d.]+)%/g, "($1/100)");

            const fRes = fmath.evaluate(fsil);
            
            // Only show if the result type is exactly a Fraction (meaning it didn't devolve into a floating point number)
            if (fmath.typeOf(fRes) === 'Fraction') {
                if (fRes.d !== 1 && Math.abs(fRes.n) <= 99999999 && Math.abs(fRes.d) <= 99999999) {
                    fractionDisplay.innerText = `${fRes.n} / ${fRes.d}`;
                } else {
                    fractionDisplay.innerText = "";
                }
            } else {
                fractionDisplay.innerText = "";
            }
        } catch (err) {
            fractionDisplay.innerText = "";
        }

        // Hide expression history and live preview
        const formattedExpr = formatDisplayExpr(currentInput);
        exprDisplay.innerText = formattedExpr + ' =';
        exprDisplay.classList.add('shown');
        livePreviewDisplay.classList.remove('shown');

        // Push to history log (cap at 50)
        calcHistory.push({ 
            expr: formattedExpr, 
            result: decimalDisplay.innerHTML,
            rawResult: cleanDec.toString() // exact result string for injection
        });
        if (calcHistory.length > 50) calcHistory.shift();

        adjustFontSize();
        
        setTimeout(() => {
            decimalDisplay.scrollTo({ left: 0, behavior: 'smooth' });
            exprDisplay.scrollTo({ left: exprDisplay.scrollWidth, behavior: 'smooth' });
        }, 0);
    } catch (e) {
        decimalDisplay.classList.add('error-text');
        const msg = e.message ? e.message.toLowerCase() : "";
        
        if (msg.includes('zero') || currentInput.match(/\/0(?!\.)/)) {
            decimalDisplay.innerText = "Can't divide by 0";
        } else if (e.message === "Domain Error") {
            decimalDisplay.innerText = "Domain Error";
        } else if (e.message === "Be Real") {
            decimalDisplay.innerText = "Be Real";
        } else if (e.message === "Overload") {
            decimalDisplay.innerText = "Overload";
        } else {
            decimalDisplay.innerText = "Error";
        }
        adjustFontSize();
    }
}

// ── Scientific Mode State ──
let sciMode = false;
let angleMode = 'deg'; // 'deg' or 'rad'
let invMode = false;

function toRad(x) { return angleMode === 'deg' ? x * Math.PI / 180 : x; }
function toDeg(x) { return angleMode === 'deg' ? x * 180 / Math.PI : x; }

function sciFunc(fn) {
    const lastChar = currentInput.slice(-1);
    const hasExpr = currentInput.length > 0;
    
    switch(fn) {
        case 'sin':
            if (invMode) currentInput += 'asin(';
            else currentInput += 'sin(';
            break;
        case 'cos':
            if (invMode) currentInput += 'acos(';
            else currentInput += 'cos(';
            break;
        case 'tan':
            if (invMode) currentInput += 'atan(';
            else currentInput += 'tan(';
            break;
        case 'log':
            if (invMode) currentInput += 'E'; // 10^x button acts as EXP (E)
            else currentInput += 'log(';
            break;
        case 'ln':
            if (invMode) currentInput += 'e^('; // e^x as inverse of ln
            else currentInput += 'ln(';
            break;
        case 'sqrt':
            if (invMode) {
                if (hasExpr && !isOperatorEnd()) currentInput += '^2 ';
                else currentInput += '^2 ';
            } else {
                currentInput += 'sqrt(';
            }
            break;
        case 'cbrt':
            if (invMode) {
                if (hasExpr && !isOperatorEnd()) currentInput += '^3 ';
                else currentInput += '^3 ';
            } else {
                currentInput += 'cbrt(';
            }
            break;
        case 'fact':
            if (hasExpr && !isOperatorEnd()) currentInput += '!';
            break;
        case 'nCr':
            const l = currentInput.slice(-1);
            if (!isNaN(l) && l !== "" && l !== " ") { 
                currentInput += invMode ? 'P' : 'C';
            }
            break;
        case 'pow':
            if (hasExpr && !isOperatorEnd()) currentInput += '^';
            break;
        case 'pi':
            currentInput += 'pi';
            break;
        case 'e':
            currentInput += 'e';
            break;
    }
    updateUI(currentInput);
    if (invMode) {
        invMode = false;
        document.querySelector('.btn.sci.inv')?.classList.remove('active');
        updateInvLabels();
    }
}

function isOperatorEnd() {
    const c = currentInput.slice(-1);
    return ['+', '-', '*', '/', '^', '(', ''].includes(c);
}

function toggleDegRad() {
    angleMode = angleMode === 'deg' ? 'rad' : 'deg';
    const btn = document.getElementById('btn-deg-rad');
    if (btn) {
        btn.textContent = angleMode;
        btn.classList.toggle('rad-mode', angleMode === 'rad');
    }
    if (navigator.vibrate) navigator.vibrate(20);
}

function updateInvLabels() {
    const btnSin = document.querySelector('button[onclick="sciFunc(\'sin\')"]');
    const btnCos = document.querySelector('button[onclick="sciFunc(\'cos\')"]');
    const btnTan = document.querySelector('button[onclick="sciFunc(\'tan\')"]');
    const btnSqrt = document.querySelector('button[onclick="sciFunc(\'sqrt\')"]');
    const btnCbrt = document.querySelector('.btn-cbrt');
    const btnLog = document.querySelector('button[onclick="sciFunc(\'log\')"]');
    const btnLn = document.querySelector('button[onclick="sciFunc(\'ln\')"]');
    const btnPow = document.querySelector('button[onclick="sciFunc(\'pow\')"]');
    const btnNcr = document.querySelector('button[onclick="sciFunc(\'nCr\')"]');

    if (invMode) {
        if(btnSin) btnSin.textContent = 'sin\u207B\u00B9';
        if(btnCos) btnCos.textContent = 'cos\u207B\u00B9';
        if(btnTan) btnTan.textContent = 'tan\u207B\u00B9';
        if(btnSqrt) btnSqrt.textContent = 'x\u00B2';
        if(btnCbrt) btnCbrt.innerHTML = '<span class="cbrt-icon">x\u00B3</span>';
        if(btnLog) btnLog.textContent = 'EXP';
        if(btnLn) btnLn.textContent = 'e\u02E3';
        if(btnNcr) btnNcr.textContent = 'nPr';
    } else {
        if(btnSin) btnSin.textContent = 'sin';
        if(btnCos) btnCos.textContent = 'cos';
        if(btnTan) btnTan.textContent = 'tan';
        if(btnSqrt) btnSqrt.innerHTML = '<i class="fi fi-rr-square-root"></i>';
        if(btnCbrt) btnCbrt.innerHTML = '<span class="cbrt-icon">\u00B3\u221A</span>';
        if(btnLog) btnLog.textContent = 'log';
        if(btnLn) btnLn.textContent = 'ln';
        if(btnNcr) btnNcr.textContent = 'nCr';
    }
}

function toggleInv() {
    invMode = !invMode;
    const btn = document.querySelector('.btn.sci.inv');
    if (btn) btn.classList.toggle('active', invMode);
    updateInvLabels();
    if (navigator.vibrate) navigator.vibrate(15);
}

// ── Dynamic Button Setup (haptic + tap + proximity) ──
// Must be callable any time buttons are shown/hidden
function setupBtnListeners() {
    const allBtns = Array.from(document.querySelectorAll('.btn'));
    const visibleBtns = allBtns.filter(b => b.offsetParent !== null || b.closest('.sci-rows'));
    // For proximity — only visible ones count
    const activeBtns = allBtns.filter(b => getComputedStyle(b).display !== 'none');
    const cols = sciMode ? 5 : 4;

    activeBtns.forEach((btn, index) => {
        // Remove old listeners by cloning (lightweight approach — we replace handlers via re-registration)
        // Instead we store a flag
        if (btn._sciSetup) return;
        btn._sciSetup = true;

        // Haptic
        btn.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(45); });

        // Tap glow
        let tapTimeout;
        const addTap = () => {
            btn.style.transition = 'none';
            btn.classList.add('tapped');
            clearTimeout(tapTimeout);
            tapTimeout = setTimeout(() => {
                btn.style.transition = '';
                btn.classList.remove('tapped');
            }, 100);
        };
        const removeTap = () => {
            btn.style.transition = '';
            btn.classList.remove('tapped');
        };
        btn.addEventListener('touchstart', addTap, { passive: true });
        btn.addEventListener('mousedown', addTap);
        btn.addEventListener('touchend', removeTap, { passive: true });
        btn.addEventListener('mouseup', removeTap);
        btn.addEventListener('mouseleave', removeTap);
        btn.addEventListener('touchcancel', removeTap, { passive: true });
    });

    // Proximity lighting — always recalculated fresh
    activeBtns.forEach((btn, index) => {
        const startLight = () => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const color = getComputedStyle(btn).getPropertyValue('--glow-color').trim() || 'rgba(255, 255, 255, 0.3)';

            activeBtns.forEach((other, otherIdx) => {
                if (other === btn) {
                    other.style.transition = 'none';
                    if (btn.classList.contains('ac') || btn.classList.contains('equal')) {
                        other.style.setProperty('--prox-glow', `inset 0 0 15px 0px ${color}, inset 0 0 0 transparent`);
                    } else {
                        other.style.setProperty('--prox-glow', `inset 0 0 60px 20px ${color}, inset 0 0 15px 0px ${color}`);
                    }
                    return;
                }
                const oRow = Math.floor(otherIdx / cols);
                const oCol = otherIdx % cols;
                const dx = oCol - col;
                const dy = oRow - row;
                if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                    const iX = (dx !== 0 && dy !== 0) ? dx * 2 : dx * 4;
                    const iY = (dx !== 0 && dy !== 0) ? dy * 2 : dy * 4;
                    other.style.transition = 'none';
                    other.style.setProperty('--prox-glow', `inset ${iX}px ${iY}px 5px 0px ${color}, inset 0 0 0 transparent`);
                }
            });
        };
        const stopLight = () => {
            activeBtns.forEach(other => {
                other.style.transition = '';
                other.style.setProperty('--prox-glow', 'inset 0 0 0 transparent, inset 0 0 0 transparent');
            });
        };
        btn.removeEventListener('touchstart', btn._startLight);
        btn.removeEventListener('mousedown', btn._startLight);
        btn.removeEventListener('touchend', btn._stopLight);
        btn.removeEventListener('mouseup', btn._stopLight);
        btn.removeEventListener('mouseleave', btn._stopLight);
        btn.removeEventListener('touchcancel', btn._stopLight);
        btn._startLight = startLight;
        btn._stopLight = stopLight;
        btn.addEventListener('touchstart', startLight, { passive: true });
        btn.addEventListener('mousedown', startLight);
        btn.addEventListener('touchend', stopLight, { passive: true });
        btn.addEventListener('mouseup', stopLight);
        btn.addEventListener('mouseleave', stopLight);
        btn.addEventListener('touchcancel', stopLight, { passive: true });
    });
}

// Initial setup
setupBtnListeners();

// Display interaction (Long press to copy)
const displayContainer = document.querySelector('.display');
let touchTimer;

displayContainer.addEventListener('touchstart', () => {
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

displayContainer.addEventListener('touchend', () => {
    clearTimeout(touchTimer);
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
            if (navigator.vibrate) navigator.vibrate([50, 40, 50, 40, 120]);
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

// ── Liquid Glass Switcher: Mode Toggle Integration ──
function activateSciMode(enable) {
    sciMode = enable;
    document.body.classList.toggle('sci-mode', sciMode);
    if (navigator.vibrate) navigator.vibrate(sciMode ? [20, 10, 20] : 15);
    // Recalculate proximity lighting with new column count
    setTimeout(() => {
        document.querySelectorAll('.btn').forEach(b => {
            if (b._startLight) {
                b.removeEventListener('touchstart', b._startLight);
                b.removeEventListener('mousedown', b._startLight);
                b.removeEventListener('touchend', b._stopLight);
                b.removeEventListener('mouseup', b._stopLight);
                b.removeEventListener('mouseleave', b._stopLight);
                b.removeEventListener('touchcancel', b._stopLight);
                delete b._startLight;
                delete b._stopLight;
                delete b._sciSetup;
            }
        });
        setupBtnListeners();
    }, 50);
}

const switcherEl = document.querySelector('.switcher');
if (switcherEl) {
    // trackPrevious: drives the slide animation origin
    const trackPrevious = (el) => {
        const radios = el.querySelectorAll('input[type="radio"]');
        let previousValue = null;
        const initiallyChecked = el.querySelector('input[type="radio"]:checked');
        if (initiallyChecked) {
            previousValue = initiallyChecked.getAttribute('c-option');
            el.setAttribute('c-previous', previousValue);
        }
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    el.setAttribute('c-previous', previousValue ?? '');
                    previousValue = radio.getAttribute('c-option');
                }
            });
        });
    };
    trackPrevious(switcherEl);

    // Wire radio changes to sciMode
    switcherEl.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                activateSciMode(radio.value === 'scientific');
            }
        });
    });
}

// ── History Panel ──
const btnHistory = document.getElementById('btn-history');
const historyPanel = document.getElementById('history-panel');
const btnClearHistory = document.getElementById('btn-clear-history');
const historyList = document.getElementById('history-list');

function renderHistory() {
    if (calcHistory.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No calculations yet</div>';
        return;
    }
    historyList.innerHTML = calcHistory
        .slice()
        .reverse()
        .map(entry => `
            <div class="history-item">
                <div class="history-expr" onclick="injectHistory('${entry.rawResult || entry.result}')">${entry.expr} =</div>
                <div class="history-result" onclick="injectHistory('${entry.rawResult || entry.result}')">${entry.result}</div>
            </div>`)
        .join('');
}

function closeHistory() {
    historyPanel.classList.remove('open');
    btnHistory.classList.remove('active');
}

btnHistory.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !historyPanel.classList.contains('open');
    if (opening) {
        renderHistory();
        closeConstants(); // Close constants when opening history
    }
    historyPanel.classList.toggle('open', opening);
    btnHistory.classList.toggle('active', opening);
});

// ── Scientific Constants ──
const btnConstants = document.getElementById('btn-constants');
const constantsPanel = document.getElementById('constants-panel');

function closeConstants() {
    constantsPanel.classList.remove('open');
    btnConstants.classList.remove('active');
}

btnConstants.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !constantsPanel.classList.contains('open');
    if (opening) closeHistory(); // Close history when opening constants
    constantsPanel.classList.toggle('open', opening);
    btnConstants.classList.toggle('active', opening);
});

window.injectConstant = function(val, sym) {
    if (val === 'undefined' || val === 'null' || !val) return;

    const lastChar = currentInput.slice(-1);
    const operators = ['+', '-', '*', '/', '(', '^'];
    
    if (!currentInput || operators.includes(lastChar)) {
        currentInput += val;
    } else {
        // If it follows a number or function, use implicit multiplication
        currentInput += '*' + val;
    }
    
    updateUI(currentInput);
    closeConstants();
    if (navigator.vibrate) navigator.vibrate(15);
};

btnClearHistory.addEventListener('click', (e) => {
    e.stopPropagation();
    calcHistory = [];
    renderHistory();
});

// Close on any tap outside the panel
document.addEventListener('click', (e) => {
    if (!historyPanel.contains(e.target) && !e.target.closest('#btn-history')) {
        closeHistory();
    }
    if (constantsPanel && !constantsPanel.contains(e.target) && !e.target.closest('#btn-constants')) {
        closeConstants();
    }
});

document.addEventListener('touchstart', (e) => {
    if (!historyPanel.contains(e.target) && !e.target.closest('#btn-history')) {
        closeHistory();
    }
    if (constantsPanel && !constantsPanel.contains(e.target) && !e.target.closest('#btn-constants')) {
        closeConstants();
    }
}, { passive: true });

// --- History Injection ---
window.injectHistory = function(val, entryIdx) {
    if (val === 'undefined' || val === 'null' || !val) return;
    
    // Pulse animation on the display
    decimalDisplay.classList.remove('pulse-inject');
    void decimalDisplay.offsetWidth; // Trigger reflow
    decimalDisplay.classList.add('pulse-inject');

    // Auto-replace default zero or append visually
    const lastChar = currentInput.slice(-1);
    if (!currentInput || ['+', '-', '*', '/'].includes(lastChar)) {
        currentInput += val;
    } else {
        currentInput = val; 
    }
    
    updateUI(currentInput);
    closeHistory();
    if (navigator.vibrate) navigator.vibrate(25);
};

// --- Swipe Reveal Handlers ---
function expandSwipeReveal(el) {
    const full = el.getAttribute('data-full');
    if (full) {
        const parent = el.parentElement;
        parent.innerHTML = full.replace(/\[(.*?)\]/g, '<span class="overline">$1</span>');
        if (navigator.vibrate) navigator.vibrate(10);
    }
}

document.addEventListener('touchmove', (e) => {
    const target = e.target.closest('.swipe-reveal');
    if (target) expandSwipeReveal(target);
}, {passive: true});

document.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) > 0) {
        const target = e.target.closest('.swipe-reveal');
        if (target) expandSwipeReveal(target);
    }
}, {passive: true});

document.addEventListener('click', (e) => {
    const target = e.target.closest('.swipe-reveal');
    if (target) expandSwipeReveal(target);
});

// --- Hardware Keyboard Support ---
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const key = e.key;
    
    if (/[0-9\.\%]/.test(key) || ['+', '-', '*', '/'].includes(key)) {
        e.preventDefault();
        append(key);
    } else if (key === '(' || key === ')') {
        e.preventDefault();
        append(key); 
    } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        calculate();
        const eqBtn = document.querySelector('.btn.equal');
        if (eqBtn) {
            eqBtn.classList.add('tapped');
            setTimeout(() => eqBtn.classList.remove('tapped'), 100);
        }
    } else if (key === 'Backspace') {
        e.preventDefault();
        backspace();
    } else if (key === 'Escape') {
        e.preventDefault();
        clearAll();
        const acBtn = document.querySelector('.btn.ac');
        if (acBtn) {
            acBtn.classList.add('tapped');
            setTimeout(() => acBtn.classList.remove('tapped'), 100);
        }
    }
});