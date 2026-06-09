(() => {
	'use strict';

	const BOARD_SIZE = 11;
	const CENTER = { r: 5, c: 5 };
	const COLOR = { BLACK: 'B', WHITE: 'W' };
	const NO_KNIGHT_LAND_CELLS = new Set([
		'3,5',
		'4,4', '4,5', '4,6',
		'5,3', '5,4', '5,5', '5,6', '5,7',
		'6,4', '6,5', '6,6',
		'7,5',
	]);

	/** @type {(COLOR.BLACK|COLOR.WHITE)[][]} */
	let board;
	let currentTurn = COLOR.BLACK;
	let selected = null; // { r, c }

	const elBoard = document.getElementById('board');
	const elTurn = document.getElementById('turnDisplay');
	const elToast = document.getElementById('toast');
	const elReset = document.getElementById('resetBtn');
	const elModeSelect = document.getElementById('modeSelect');
	const elDifficultySelect = document.getElementById('difficultySelect');
	const elDifficultyWrap = document.getElementById('difficultyWrap');
	const elMusicBtn = document.getElementById('musicBtn');
	const elWinFx = document.getElementById('winFx');
	const elReviewCtrls = document.getElementById('reviewCtrls');
	const elReviewStart = document.getElementById('reviewStartBtn');
	const elReviewPrev = document.getElementById('reviewPrevBtn');
	const elReviewNext = document.getElementById('reviewNextBtn');
	const elReviewExit = document.getElementById('reviewExitBtn');
	const elReviewStep = document.getElementById('reviewStep');

	let bgmAudio = null;
	let bgmOn = false;

	let moveHistory = []; // { from:{r,c}, to:{r,c}, kind:'slide'|'knight', color:'B'|'W' }
	let isReviewMode = false;
	let reviewIndex = 0; // 0..moveHistory.length (0=초기)
	let gameMode = 'pvp'; // 'pvp' | 'ai'
	const aiColor = COLOR.WHITE;
	let aiThinking = false;
	let aiDifficulty = 'easy'; // 'easy' | 'medium' | 'hard'

	function updateDifficultyVisibility() {
		elDifficultyWrap.hidden = gameMode !== 'ai';
	}

	function showToast(message) {
		elToast.textContent = message;
		elToast.classList.add('show');
		setTimeout(() => elToast.classList.remove('show'), 1200);
	}

	function centerOfCell(r, c) {
		const cell = getCellEl(r, c);
		if (!cell) return null;
		const boardRect = elBoard.getBoundingClientRect();
		const rect = cell.getBoundingClientRect();
		return {
			x: rect.left - boardRect.left + rect.width / 2,
			y: rect.top - boardRect.top + rect.height / 2,
		};
	}

	function playMoveTrail(from, to, color) {
		const p1 = centerOfCell(from.r, from.c);
		const p2 = centerOfCell(to.r, to.c);
		if (!p1 || !p2) return;
		const dx = p2.x - p1.x;
		const dy = p2.y - p1.y;
		const len = Math.hypot(dx, dy);
		const angle = Math.atan2(dy, dx) * (180 / Math.PI);

		const trail = document.createElement('div');
		trail.className = 'move-trail';
		trail.style.left = `${p1.x}px`;
		trail.style.top = `${p1.y}px`;
		trail.style.width = `${len}px`;
		trail.style.transform = `translateY(-50%) rotate(${angle}deg)`;
		trail.style.background = color === COLOR.BLACK
			? 'linear-gradient(90deg, rgba(30,64,175,0), rgba(30,64,175,0.65), rgba(96,165,250,0))'
			: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.85), rgba(148,163,184,0))';
		elBoard.appendChild(trail);
		setTimeout(() => trail.remove(), 360);
	}

	function showWinEffect(winner) {
		elWinFx.innerHTML = '';
		elWinFx.classList.add('show');
		const badge = document.createElement('div');
		badge.className = 'win-badge';
		badge.textContent = `${winner} 승리!`;
		elWinFx.appendChild(badge);

		for (let i = 0; i < 28; i++) {
			const p = document.createElement('span');
			p.className = 'particle';
			p.style.left = `${50 + (Math.random() * 16 - 8)}%`;
			p.style.top = `${48 + (Math.random() * 10 - 5)}%`;
			p.style.setProperty('--tx', `${(Math.random() * 2 - 1) * 280}px`);
			p.style.setProperty('--ty', `${(Math.random() * 2 - 1) * 220}px`);
			p.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
			p.style.background = i % 2 === 0 ? '#60a5fa' : '#34d399';
			elWinFx.appendChild(p);
		}
		setTimeout(() => {
			elWinFx.classList.remove('show');
			elWinFx.innerHTML = '';
		}, 1800);
	}

	function initBoard() {
		board = Array.from({ length: BOARD_SIZE }, () =>
			Array.from({ length: BOARD_SIZE }, () => null)
		);
		placeInitialPieces();
		currentTurn = COLOR.BLACK;
		selected = null;
		updateTurnDisplay();
		render();
		moveHistory = [];
		isReviewMode = false;
		reviewIndex = 0;
		aiThinking = false;
		updateReviewUI();
		if (isAiTurn()) maybeTriggerAiTurn();
	}

	function placeInitialPieces() {
		// Black: 왼쪽 위 ㄴ
		setPiece(0,0,COLOR.BLACK);
		setPiece(0,1,COLOR.BLACK);
		setPiece(0,2,COLOR.BLACK);
		setPiece(1,0,COLOR.BLACK);
		setPiece(2,0,COLOR.BLACK);
		// Black: 오른쪽 아래 ㄴ
		setPiece(10,10,COLOR.BLACK);
		setPiece(10,9,COLOR.BLACK);
		setPiece(10,8,COLOR.BLACK);
		setPiece(9,10,COLOR.BLACK);
		setPiece(8,10,COLOR.BLACK);
		// White: 오른쪽 위 ㄴ
		setPiece(0,10,COLOR.WHITE);
		setPiece(0,9,COLOR.WHITE);
		setPiece(0,8,COLOR.WHITE);
		setPiece(1,10,COLOR.WHITE);
		setPiece(2,10,COLOR.WHITE);
		// White: 왼쪽 아래 ㄴ
		setPiece(10,0,COLOR.WHITE);
		setPiece(10,1,COLOR.WHITE);
		setPiece(10,2,COLOR.WHITE);
		setPiece(9,0,COLOR.WHITE);
		setPiece(8,0,COLOR.WHITE);
	}

	function reconstructBoardAt(step) {
		// step: 0..moveHistory.length
		board = Array.from({ length: BOARD_SIZE }, () =>
			Array.from({ length: BOARD_SIZE }, () => null)
		);
		placeInitialPieces();
		for (let i = 0; i < step; i++) {
			const m = moveHistory[i];
			board[m.from.r][m.from.c] = null;
			board[m.to.r][m.to.c] = m.color;
		}
		selected = null;
		render();
	}

	function setPiece(r, c, color) {
		board[r][c] = color;
	}
	function getPiece(r, c) {
		return board[r][c];
	}
	function inBounds(r, c) {
		return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
	}
	function isEmpty(r, c) {
		return inBounds(r, c) && !getPiece(r, c);
	}
	function isNoKnightLandCell(r, c) {
		return NO_KNIGHT_LAND_CELLS.has(`${r},${c}`);
	}

	function updateTurnDisplay() {
		const isAi = gameMode === 'ai' && currentTurn === aiColor;
		elTurn.textContent = currentTurn === COLOR.BLACK ? '흑' : (isAi ? '백(AI)' : '백');
	}

	function switchTurn() {
		currentTurn = currentTurn === COLOR.BLACK ? COLOR.WHITE : COLOR.BLACK;
		updateTurnDisplay();
		selected = null;
		clearHighlights();
	}

	function checkWin() {
		const winner = getPiece(CENTER.r, CENTER.c);
		if (!winner) return null;
		return winner === COLOR.BLACK ? '흑' : '백';
	}

	function render() {
		elBoard.innerHTML = '';
		for (let r = 0; r < BOARD_SIZE; r++) {
			for (let c = 0; c < BOARD_SIZE; c++) {
				const cell = document.createElement('button');
				cell.className = 'cell' + (((r + c) % 2 === 0) ? '' : ' alt');
				cell.dataset.r = String(r);
				cell.dataset.c = String(c);
				cell.title = `(${r},${c})`;

				if (r === CENTER.r && c === CENTER.c) {
					cell.classList.add('center');
				}
				if (isNoKnightLandCell(r, c)) {
					cell.classList.add('no-knight-land');
				}

				const piece = getPiece(r, c);
				if (piece) {
					const div = document.createElement('div');
					div.className = 'piece ' + (piece === COLOR.BLACK ? 'black' : 'white');
					const span = document.createElement('span');
					span.className = 'glyph';
					span.textContent = piece === COLOR.BLACK ? '♞' : '♘';
					div.appendChild(span);
					if (selected && selected.r === r && selected.c === c) {
						div.classList.add('selected');
					}
					cell.appendChild(div);
				}

				cell.addEventListener('click', onCellClick);
				elBoard.appendChild(cell);
			}
		}
		applyMoveHighlights();
	}

	function clearHighlights() {
		elBoard.querySelectorAll('.cell.highlight-knight, .cell.highlight-slide, .cell.invalid').forEach(el => {
			el.classList.remove('highlight-knight', 'highlight-slide', 'invalid');
		});
	}

	function onCellClick(e) {
		if (isReviewMode) return; // 리뷰 중 클릭 무시
		if (isAiTurn() || aiThinking) return; // AI 턴 입력 무시
		const cell = e.currentTarget;
		const r = Number(cell.dataset.r);
		const c = Number(cell.dataset.c);
		const piece = getPiece(r, c);

		// Selecting a piece
		if (!selected) {
			if (!piece) {
				// 빈 칸 클릭은 무시
				return;
			}
			if (piece !== currentTurn) {
				showToast('자기 말만 선택할 수 있습니다.');
				return;
			}
			selected = { r, c };
			render();
			return;
		}

		// Already selected:
		// 1) 클릭한 칸에 내 말이 있으면 선택을 그 말로 변경
		if (piece && piece === currentTurn) {
			selected = { r, c };
			render();
			return;
		}

		// 2) 나이트 유효 칸이면 점프
		const knightTargets = getValidKnightTargets(selected);
		const isKnight = knightTargets.some(p => p.r === r && p.c === c);
		if (isKnight) {
			executeMove(selected, { r, c }, 'knight');
			return;
		}

		// 3) 미끄럼 목적 칸이면 미끄럼
		const slideTargets = getSlideTargets(selected);
		const isSlide = slideTargets.some(p => p.r === r && p.c === c);
		if (isSlide) {
			executeMove(selected, { r, c }, 'slide');
			return;
		}
		// 그 외 클릭은 무시
	}

	function getKnightMoves(r, c) {
		const deltas = [
			{ dr: 2, dc: 1 }, { dr: 2, dc: -1 },
			{ dr: -2, dc: 1 }, { dr: -2, dc: -1 },
			{ dr: 1, dc: 2 }, { dr: 1, dc: -2 },
			{ dr: -1, dc: 2 }, { dr: -1, dc: -2 },
		];
		return deltas
			.map(d => ({ r: r + d.dr, c: c + d.dc }))
			.filter(p => inBounds(p.r, p.c));
	}

	function getValidKnightTargets(from) {
		return getKnightMoves(from.r, from.c)
			.filter(p => isEmpty(p.r, p.c) && !isNoKnightLandCell(p.r, p.c));
	}

	function getAllValidMovesFor(color) {
		const all = [];
		for (let r = 0; r < BOARD_SIZE; r++) {
			for (let c = 0; c < BOARD_SIZE; c++) {
				if (getPiece(r, c) !== color) continue;
				const from = { r, c };
				for (const to of getValidKnightTargets(from)) all.push({ from, to, kind: 'knight' });
				for (const to of getSlideTargets(from)) all.push({ from, to, kind: 'slide' });
			}
		}
		return all;
	}

	function distanceToCenter(p) {
		return Math.abs(p.r - CENTER.r) + Math.abs(p.c - CENTER.c);
	}

	// 쉬움: 기존 휴리스틱
	function chooseAiMoveEasy() {
		const moves = getAllValidMovesFor(aiColor);
		if (moves.length === 0) return null;
		const winning = moves.filter(m => m.to.r === CENTER.r && m.to.c === CENTER.c);
		if (winning.length > 0) return winning[Math.floor(Math.random() * winning.length)];
		let bestScore = Number.POSITIVE_INFINITY;
		let best = [];
		for (const m of moves) {
			const score = distanceToCenter(m.to);
			if (score < bestScore) {
				bestScore = score;
				best = [m];
			} else if (score === bestScore) {
				best.push(m);
			}
		}
		return best[Math.floor(Math.random() * best.length)];
	}

	// 보통/어려움: 미니맥스(+알파베타, 제한 깊이/시간)
	function getPieceAt(b, r, c) { return b[r][c]; }
	function isEmptyAt(b, r, c) { return r>=0 && r<BOARD_SIZE && c>=0 && c<BOARD_SIZE && !b[r][c]; }
	function slideDestinationAt(b, from, dir) {
		const delta = { up:{dr:-1,dc:0}, down:{dr:1,dc:0}, left:{dr:0,dc:-1}, right:{dr:0,dc:1} }[dir];
		let r = from.r, c = from.c;
		while (true) {
			const nr = r + delta.dr, nc = c + delta.dc;
			if (!(nr>=0 && nr<BOARD_SIZE && nc>=0 && nc<BOARD_SIZE)) break;
			if (!isEmptyAt(b, nr, nc)) break;
			r = nr; c = nc;
		}
		return { r, c };
	}
	function getValidKnightTargetsAt(b, from) {
		const deltas = [
			{ dr: 2, dc: 1 }, { dr: 2, dc: -1 },
			{ dr: -2, dc: 1 }, { dr: -2, dc: -1 },
			{ dr: 1, dc: 2 }, { dr: 1, dc: -2 },
			{ dr: -1, dc: 2 }, { dr: -1, dc: -2 },
		];
		const out = [];
		for (const d of deltas) {
			const r = from.r + d.dr, c = from.c + d.dc;
			if (r>=0 && r<BOARD_SIZE && c>=0 && c<BOARD_SIZE &&
				!getPieceAt(b,r,c) && !isNoKnightLandCell(r,c)) {
				out.push({ r, c });
			}
		}
		return out;
	}
	function getAllValidMovesForAt(b, color) {
		const out = [];
		for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) {
			if (getPieceAt(b,r,c) !== color) continue;
			const from = { r, c };
			for (const to of getValidKnightTargetsAt(b, from)) out.push({ from, to, kind:'knight' });
			for (const d of ['up','down','left','right']) {
				const to = slideDestinationAt(b, from, d);
				if (!(to.r===from.r && to.c===from.c)) out.push({ from, to, kind:'slide' });
			}
		}
		return out;
	}
	function isWinOnBoard(b, color) { return b[CENTER.r][CENTER.c] === color; }
	function manhattanMinToCenterFor(b, color) {
		let best = Infinity;
		for (let r=0;r<BOARD_SIZE;r++) for (let c=0;c<BOARD_SIZE;c++) {
			if (b[r][c] === color) {
				const d = Math.abs(r-CENTER.r)+Math.abs(c-CENTER.c);
				if (d < best) best = d;
			}
		}
		return best;
	}
	function evaluateBoard(b) {
		const opp = aiColor === COLOR.BLACK ? COLOR.WHITE : COLOR.BLACK;
		if (isWinOnBoard(b, aiColor)) return 1e9;
		if (isWinOnBoard(b, opp)) return -1e9;
		const aiMin = manhattanMinToCenterFor(b, aiColor);
		const oppMin = manhattanMinToCenterFor(b, opp);
		const aiMoves = getAllValidMovesForAt(b, aiColor).length;
		const oppMoves = getAllValidMovesForAt(b, opp).length;
		return (-(aiMin*200) + (-(oppMin)*-200)) + (aiMoves - oppMoves)*3;
	}
	function minimax(b, depth, alpha, beta, maximizing) {
		const ai = aiColor;
		const opp = ai === COLOR.BLACK ? COLOR.WHITE : COLOR.BLACK;
		if (depth === 0 || isWinOnBoard(b, ai) || isWinOnBoard(b, opp)) {
			return { score: evaluateBoard(b) };
		}
		if (maximizing) {
			let best = { score: -Infinity };
			const moves = getAllValidMovesForAt(b, ai);
			moves.sort((m1,m2)=> (Math.abs(m1.to.r- CENTER.r)+Math.abs(m1.to.c- CENTER.c)) - (Math.abs(m2.to.r- CENTER.r)+Math.abs(m2.to.c- CENTER.c)));
			for (const m of moves) {
				const captured = b[m.to.r][m.to.c];
				// make
				const moving = b[m.from.r][m.from.c];
				b[m.from.r][m.from.c] = null;
				b[m.to.r][m.to.c] = moving;
				const val = minimax(b, depth-1, alpha, beta, false).score;
				// undo
				b[m.to.r][m.to.c] = captured;
				b[m.from.r][m.from.c] = moving;
				if (val > best.score) best = { score: val, move: m };
				alpha = Math.max(alpha, val);
				if (beta <= alpha) break;
			}
			return best;
		} else {
			let best = { score: Infinity };
			const moves = getAllValidMovesForAt(b, opp);
			moves.sort((m1,m2)=> (Math.abs(m2.to.r- CENTER.r)+Math.abs(m2.to.c- CENTER.c)) - (Math.abs(m1.to.r- CENTER.r)+Math.abs(m1.to.c- CENTER.c)));
			for (const m of moves) {
				const captured = b[m.to.r][m.to.c];
				const moving = b[m.from.r][m.from.c];
				b[m.from.r][m.from.c] = null;
				b[m.to.r][m.to.c] = moving;
				const val = minimax(b, depth-1, alpha, beta, true).score;
				b[m.to.r][m.to.c] = captured;
				b[m.from.r][m.from.c] = moving;
				if (val < best.score) best = { score: val, move: m };
				beta = Math.min(beta, val);
				if (beta <= alpha) break;
			}
			return best;
		}
	}
	function chooseAiMoveMedium() {
		const b = board.map(row => row.slice());
		const res = minimax(b, 2, -Infinity, Infinity, true);
		return res.move || chooseAiMoveEasy();
	}
	function chooseAiMoveHard() {
		const b = board.map(row => row.slice());
		const start = performance.now();
		let best = null;
		for (let d = 2; d <= 4; d++) {
			if (performance.now() - start > 900) break;
			const res = minimax(b, d, -Infinity, Infinity, true);
			if (res.move) best = res.move;
		}
		return best || chooseAiMoveMedium();
	}
	function chooseAiMove() {
		if (aiDifficulty === 'easy') return chooseAiMoveEasy();
		if (aiDifficulty === 'medium') return chooseAiMoveMedium();
		return chooseAiMoveHard();
	}

	function isAiTurn() {
		return gameMode === 'ai' && currentTurn === aiColor && !isReviewMode;
	}

	function maybeTriggerAiTurn() {
		if (!isAiTurn() || aiThinking) return;
		aiThinking = true;
		selected = null;
		render();
		setTimeout(() => {
			const move = chooseAiMove();
			aiThinking = false;
			if (!move) {
				showToast('AI가 둘 수 있는 수가 없습니다.');
				return;
			}
			executeMove(move.from, move.to, move.kind);
		}, 450);
	}

	function applyMoveHighlights() {
		clearHighlights();
		if (!selected) return;
		// Knight
		const knightCells = getKnightMoves(selected.r, selected.c);
		for (const p of knightCells) {
			const el = getCellEl(p.r, p.c);
			if (isEmpty(p.r, p.c) && !isNoKnightLandCell(p.r, p.c)) {
				el.classList.add('highlight-knight');
			} else {
				el.classList.add('invalid');
			}
		}
		// Slide (terminal cells per direction)
		const slideCells = getSlideTargets(selected);
		for (const p of slideCells) {
			const el = getCellEl(p.r, p.c);
			el.classList.add('highlight-slide');
		}
	}

	function getCellEl(r, c) {
		return elBoard.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
	}

	// Collect up to 4 slide destinations from a starting position
	function getSlideTargets(from) {
		const dirs = ['up','down','left','right'];
		const out = [];
		for (const d of dirs) {
			const dest = slideDestination(from, d);
			// exclude no-move
			if (dest && !(dest.r === from.r && dest.c === from.c)) {
				out.push(dest);
			}
		}
		return out;
	}

	function slideDestination(from, dir) {
		const delta = {
			up: { dr: -1, dc: 0 },
			down: { dr: 1, dc: 0 },
			left: { dr: 0, dc: -1 },
			right: { dr: 0, dc: 1 },
		}[dir];
		if (!delta) return null;
		let r = from.r;
		let c = from.c;
		while (true) {
			const nr = r + delta.dr;
			const nc = c + delta.dc;
			// Stop before wall or before another piece
			if (!inBounds(nr, nc)) break;
			if (!isEmpty(nr, nc)) break;
			r = nr; c = nc;
		}
		// if no movement happened, destination equals origin
		return { r, c };
	}

	function executeMove(from, to, kind) {
		// sanity
		if (from.r === to.r && from.c === to.c) {
			showToast('해당 방향으로 이동할 수 없습니다.');
			return;
		}
		const moving = getPiece(from.r, from.c);
		if (!moving || moving !== currentTurn) return;
		if (!isEmpty(to.r, to.c)) return;

		playMoveTrail(from, to, moving);
		setPiece(from.r, from.c, null);
		setPiece(to.r, to.c, moving);
		moveHistory.push({ from: { ...from }, to: { ...to }, kind, color: moving });

		// win?
		const winner = checkWin();
		render();
		if (winner) {
			showToast(`${winner} 승리!`);
			showWinEffect(winner);
			disableBoard();
			// 리뷰 UI 표시
			elReviewCtrls.hidden = false;
			elReviewStart.disabled = false;
			elReviewPrev.disabled = true;
			elReviewNext.disabled = true;
			elReviewExit.disabled = true;
			elReviewStep.textContent = `0/${moveHistory.length}`;
			return;
		}
		switchTurn();
		maybeTriggerAiTurn();
	}

	function disableBoard() {
		elBoard.querySelectorAll('.cell').forEach(el => {
			el.disabled = true;
		});
	}

	// Reset
	elReset.addEventListener('click', () => {
		initBoard();
		elBoard
			.querySelectorAll('.cell')
			.forEach(el => (el.disabled = false));
		showToast('게임이 초기화되었습니다.');
		// 리뷰 UI 초기화
		elReviewCtrls.hidden = true;
		elReviewStart.disabled = true;
		elReviewPrev.disabled = true;
		elReviewNext.disabled = true;
		elReviewExit.disabled = true;
		isReviewMode = false;
		reviewIndex = 0;
	});
	elMusicBtn.addEventListener('click', () => toggleBgm());
	elModeSelect.addEventListener('change', () => {
		gameMode = elModeSelect.value === 'ai' ? 'ai' : 'pvp';
		updateDifficultyVisibility();
		showToast(gameMode === 'ai' ? 'VS AI 모드' : '2인 대전 모드');
		initBoard();
		elBoard.querySelectorAll('.cell').forEach(el => (el.disabled = false));
		elReviewCtrls.hidden = true;
		elReviewStart.disabled = true;
		elReviewPrev.disabled = true;
		elReviewNext.disabled = true;
		elReviewExit.disabled = true;
	});
	elDifficultySelect.addEventListener('change', () => {
		aiDifficulty = elDifficultySelect.value;
		if (gameMode === 'ai') showToast(`난이도: ${aiDifficulty === 'easy' ? '쉬움' : aiDifficulty === 'medium' ? '보통' : '어려움'}`);
	});

	// BGM: bgm.ogg 재생
	function toggleBgm(forceOff = false) {
		if (forceOff) {
			if (bgmAudio) {
				try { bgmAudio.pause(); } catch {}
			}
			bgmAudio = null;
			bgmOn = false;
			elMusicBtn.textContent = 'BGM 켜기';
			return;
		}
		if (!bgmOn) {
			try {
				if (!bgmAudio) {
					bgmAudio = new Audio('./bgm.ogg');
					bgmAudio.loop = true;
					bgmAudio.volume = 0.25;
				}
				bgmAudio.currentTime = 0;
				bgmAudio.play().then(() => {
					bgmOn = true;
					elMusicBtn.textContent = 'BGM 끄기';
					showToast('배경 음악 ON');
				}).catch(() => {
					showToast('bgm.ogg 재생에 실패했어요.');
				});
			} catch {
				showToast('오디오를 초기화할 수 없어요.');
			}
		} else {
			if (bgmAudio) {
				try { bgmAudio.pause(); } catch {}
			}
			bgmOn = false;
			elMusicBtn.textContent = 'BGM 켜기';
			showToast('배경 음악 OFF');
		}
	}

	// Review UI
	function updateReviewUI() {
		elReviewStep.textContent = `${reviewIndex}/${moveHistory.length}`;
		elReviewPrev.disabled = reviewIndex <= 0;
		elReviewNext.disabled = reviewIndex >= moveHistory.length;
		elReviewExit.disabled = !isReviewMode;
	}

	elReviewStart.addEventListener('click', () => {
		if (moveHistory.length === 0) return;
		isReviewMode = true;
		reviewIndex = 0;
		reconstructBoardAt(reviewIndex);
		updateReviewUI();
		elReviewStart.disabled = true;
		elReviewPrev.disabled = true;
		elReviewNext.disabled = false;
		elReviewExit.disabled = false;
		showToast('복기를 시작합니다.');
	});

	elReviewPrev.addEventListener('click', () => {
		if (!isReviewMode) return;
		if (reviewIndex <= 0) return;
		reviewIndex -= 1;
		reconstructBoardAt(reviewIndex);
		updateReviewUI();
	});

	elReviewNext.addEventListener('click', () => {
		if (!isReviewMode) return;
		if (reviewIndex >= moveHistory.length) return;
		reviewIndex += 1;
		reconstructBoardAt(reviewIndex);
		updateReviewUI();
	});

	elReviewExit.addEventListener('click', () => {
		if (!isReviewMode) return;
		isReviewMode = false;
		reviewIndex = moveHistory.length;
		reconstructBoardAt(reviewIndex);
		updateReviewUI();
		elReviewStart.disabled = false;
		elReviewPrev.disabled = true;
		elReviewNext.disabled = true;
		elReviewExit.disabled = true;
		showToast('복기를 종료했습니다.');
	});

	// Initialize
	updateDifficultyVisibility();
	initBoard();
})();