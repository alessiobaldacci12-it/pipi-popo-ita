let dictionary = [];

if (typeof DIZIONARIO !== 'undefined' && Array.isArray(DIZIONARIO)) {
    dictionary = DIZIONARIO.map(w => String(w).trim().toUpperCase()).filter(w => w.length === 4);
}

let gameType = 'DAILY';  
let currentTarget = 'PIPI'; 
let startWord = ""; 
let currentChain = [];
let minMoves = 0; 
let isGameOver = false;

let stats = loadStats();

document.addEventListener('DOMContentLoaded', () => {
    initGame();

    const input = document.getElementById('word-input');
    if (input) {
        input.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                submitWord();
            }
        });
    }
});

// --- Gestione Statistiche e LocalStorage ---
function loadStats() {
    const saved = localStorage.getItem('pipipopo_stats_v3');
    if (saved) {
        return JSON.parse(saved);
    }
    return {
        played: 0,
        wins: 0,
        currentStreak: 0,
        maxStreak: 0,
        lastPlayedDate: "",
        distribution: { "+0": 0, "+1": 0, "+2": 0, "+3": 0, "+4+": 0 }
    };
}

function saveStats() {
    localStorage.setItem('pipipopo_stats_v3', JSON.stringify(stats));
}

function updateStatsOnWin(extraMoves) {
    const todayStr = new Date().toISOString().split('T')[0];

    if (gameType === 'DAILY') {
        if (stats.lastPlayedDate !== todayStr) {
            stats.played++;
            stats.wins++;
            stats.currentStreak++;
            if (stats.currentStreak > stats.maxStreak) {
                stats.maxStreak = stats.currentStreak;
            }
            stats.lastPlayedDate = todayStr;

            let key = `+${extraMoves}`;
            if (extraMoves >= 4) key = "+4+";

            if (stats.distribution[key] !== undefined) {
                stats.distribution[key]++;
            } else {
                stats.distribution["+4+"]++;
            }

            saveStats();
        }
    }
}

function updateStatsOnLoss() {
    const todayStr = new Date().toISOString().split('T')[0];

    if (gameType === 'DAILY') {
        if (stats.lastPlayedDate !== todayStr) {
            stats.played++;
            stats.currentStreak = 0; // Azzera lo streak sulla resa
            stats.lastPlayedDate = todayStr;
            saveStats();
        }
    }
}

// --- Gestione Modali ---
function openStatsModal() {
    renderStats();
    document.getElementById('stats-modal').classList.remove('hidden');
}

function closeStatsModal() {
    document.getElementById('stats-modal').classList.add('hidden');
}

function closeModal() {
    document.getElementById('rules-modal').classList.add('hidden');
    const input = document.getElementById('word-input');
    if (input) input.focus();
}

function renderStats() {
    document.getElementById('stat-played').textContent = stats.played;
    const winRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
    document.getElementById('stat-win-rate').textContent = `${winRate}%`;
    document.getElementById('stat-streak').textContent = stats.currentStreak;
    document.getElementById('stat-max-streak').textContent = stats.maxStreak;

    const container = document.getElementById('guess-distribution');
    container.innerHTML = "";

    const maxVal = Math.max(...Object.values(stats.distribution), 1);

    const labelsMap = {
        "+0": "0 (Perfetto)",
        "+1": "+1 parola",
        "+2": "+2 parole",
        "+3": "+3 parole",
        "+4+": "+4 o più"
    };

    Object.keys(stats.distribution).forEach(key => {
        const count = stats.distribution[key];
        const percentage = Math.max((count / maxVal) * 100, 8);

        const row = document.createElement('div');
        row.className = 'dist-row';
        row.innerHTML = `
            <span class="dist-label">${labelsMap[key]}</span>
            <div class="dist-bar-container">
                <div class="dist-bar ${key === '+0' ? 'perfect-bar' : ''}" style="width: ${percentage}%">${count}</div>
            </div>
        `;
        container.appendChild(row);
    });
}

// --- Logica Calcolo Percorso Minimo (BFS) ---
function isOneLetterDiff(w1, w2) {
    let diff = 0;
    for (let i = 0; i < 4; i++) {
        if (w1[i] !== w2[i]) diff++;
    }
    return diff === 1;
}

function getShortestPath(start, target) {
    if (start === target) return [start];
    
    let queue = [[start]];
    let visited = new Set([start]);

    while (queue.length > 0) {
        let path = queue.shift();
        let word = path[path.length - 1];

        for (let dictWord of dictionary) {
            if (!visited.has(dictWord) && isOneLetterDiff(word, dictWord)) {
                if (dictWord === target) {
                    return [...path, dictWord];
                }
                visited.add(dictWord);
                queue.push([...path, dictWord]);
            }
        }
    }
    return null;
}

// --- Inizializzazione della Partita ---
function getDailySeed() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}-${currentTarget}`;
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}

function initGame() {
    isGameOver = false;
    const msg = document.getElementById('message-area');
    msg.textContent = "";

    if (dictionary.length === 0) {
        msg.textContent = "Errore: dizionario non caricato!";
        msg.style.color = "#ff4d4d";
        return;
    }

    if (gameType === 'DAILY') {
        const seed = getDailySeed();
        const validWords = dictionary.filter(w => w !== currentTarget && getShortestPath(w, currentTarget) !== null);
        const index = seed % validWords.length;
        startWord = validWords[index];
    } else {
        const shuffled = [...dictionary].sort(() => 0.5 - Math.random());
        for (let word of shuffled) {
            if (word !== currentTarget && getShortestPath(word, currentTarget) !== null) {
                startWord = word;
                break;
            }
        }
    }

    const shortestPath = getShortestPath(startWord, currentTarget);
    minMoves = shortestPath ? (shortestPath.length - 1) : 0;

    currentChain = [startWord];

    document.getElementById('start-word').textContent = startWord;
    document.getElementById('target-word').textContent = currentTarget;
    document.getElementById('min-moves').textContent = "?"; 
    
    const input = document.getElementById('word-input');
    input.value = "";
    input.disabled = false;

    // Gestione visibilità pulsanti
    document.getElementById('surrender-btn').classList.remove('hidden');

    const nextBtn = document.getElementById('next-btn');
    if (gameType === 'INFINITE') {
        nextBtn.classList.remove('hidden');
    } else {
        nextBtn.classList.add('hidden');
    }

    renderBoard(false);
}

function switchGameType(type) {
    gameType = type;
    document.getElementById('btn-daily').classList.toggle('active', type === 'DAILY');
    document.getElementById('btn-infinite').classList.toggle('active', type === 'INFINITE');
    initGame();
}

function switchTarget(target) {
    currentTarget = target;
    document.getElementById('btn-pipi').classList.toggle('active', target === 'PIPI');
    document.getElementById('btn-popo').classList.toggle('active', target === 'POPO');
    initGame();
}

function submitWord() {
    if (isGameOver) return;

    const input = document.getElementById('word-input');
    const word = input.value.trim().toUpperCase();
    const msg = document.getElementById('message-area');
    msg.style.color = "";
    msg.textContent = "";

    if (word.length !== 4) {
        msg.textContent = "La parola deve essere di 4 lettere.";
        return;
    }

    if (!dictionary.includes(word)) {
        msg.textContent = "Parola non presente nel dizionario.";
        return;
    }

    const lastWord = currentChain[currentChain.length - 1];
    if (!isOneLetterDiff(lastWord, word)) {
        msg.textContent = `Devi cambiare 1 sola lettera rispetto a ${lastWord}!`;
        return;
    }

    currentChain.push(word);
    input.value = "";
    renderBoard(true);

    if (word === currentTarget) {
        isGameOver = true;
        
        const totalUserMoves = currentChain.length - 1; 
        const extraMoves = totalUserMoves - minMoves; 

        document.getElementById('min-moves').textContent = minMoves;

        if (extraMoves === 0) {
            msg.textContent = `🎉 PERFETTO! Hai raggiunto ${currentTarget} in ${totalUserMoves} mosse (0 parole in più)!`;
        } else {
            msg.textContent = `🎉 Vittoria! Hai raggiunto ${currentTarget} in ${totalUserMoves} mosse (+${extraMoves} parole rispetto al minimo di ${minMoves}).`;
        }

        input.disabled = true;
        document.getElementById('surrender-btn').classList.add('hidden');
        document.getElementById('next-btn').classList.remove('hidden');
        
        updateStatsOnWin(extraMoves);
        setTimeout(() => {
            openStatsModal();
        }, 1200);
    }
}

function surrenderGame() {
    if (isGameOver) return;

    isGameOver = true;

    const input = document.getElementById('word-input');
    input.disabled = true;

    const msg = document.getElementById('message-area');
    msg.style.color = "#ff4d4d";
    msg.textContent = `🏳️ Ti sei arreso! Il percorso minimo era di ${minMoves} mosse. Ecco la soluzione ottimale:`;

    // Rivela le mosse minime reali
    document.getElementById('min-moves').textContent = minMoves;

    // Ottieni il percorso più breve per la parola di partenza
    const optimalPath = getShortestPath(startWord, currentTarget);
    
    // Mostra il percorso ottimale sul tabellone
    renderSolutionBoard(optimalPath);

    document.getElementById('surrender-btn').classList.add('hidden');
    document.getElementById('next-btn').classList.remove('hidden');

    updateStatsOnLoss();
}

function renderBoard(animateLast = false) {
    const board = document.getElementById('chain-board');
    board.innerHTML = "";

    currentChain.forEach((word, index) => {
        const row = document.createElement('div');
        row.className = 'word-row';

        const isLastRow = index === currentChain.length - 1;

        Array.from(word).forEach((char, charIdx) => {
            const box = document.createElement('div');
            box.className = 'letter-box';

            if (char === currentTarget[charIdx]) {
                box.classList.add('correct');
            }

            if (index === 0) box.classList.add('start');
            if (word === currentTarget) box.classList.add('target');
            
            if (animateLast && isLastRow) {
                box.classList.add('pop');
                box.style.animationDelay = `${charIdx * 0.08}s`;
            }

            box.textContent = char;
            row.appendChild(box);
        });
        
        board.appendChild(row);
    });
}

function renderSolutionBoard(path) {
    if (!path) return;

    const board = document.getElementById('chain-board');
    board.innerHTML = "";

    path.forEach((word, index) => {
        const row = document.createElement('div');
        row.className = 'word-row';

        Array.from(word).forEach((char, charIdx) => {
            const box = document.createElement('div');
            box.className = 'letter-box solution';

            if (index === 0) box.classList.className = 'letter-box start';
            if (word === currentTarget) box.classList.className = 'letter-box target';

            box.textContent = char;
            row.appendChild(box);
        });

        board.appendChild(row);
    });
}