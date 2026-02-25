const { useState, useEffect, useCallback, useRef } = React;

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const TOTAL_TILES = 64;

// Magic Vines: bottom → top (climb up)
const VINES = {
  4: 18, 9: 25, 20: 38, 33: 52, 44: 61,
};

// Mischief Clouds: top → bottom (fall down)
const CLOUDS = {
  17: 6, 28: 12, 40: 22, 54: 35, 60: 41,
};

// Special tiles
const DOUBLE_ROLL = new Set([7, 16, 31, 48]);
const SWAP_TILE   = new Set([13, 29, 46]);
const FREEZE_TILE = new Set([23, 37, 55]);
const MYSTERY_TILE = new Set([10, 19, 36, 50, 58]);

const MYSTERY_REWARDS = [
  { icon: "🚀", text: "Rocket Boost! Move +6 tiles", effect: "boost" },
  { icon: "🛡️", text: "Cloud Shield! Immune to next cloud", effect: "shield" },
  { icon: "⭐", text: "Star Power! Roll twice next turn", effect: "doubleNext" },
  { icon: "🌈", text: "Rainbow Jump! Jump to nearest vine", effect: "vine" },
  { icon: "💫", text: "Lucky Star! Skip any cloud once", effect: "shield" },
];

const CHARACTERS = [
  { id: "bunny", emoji: "🐰", name: "Bunny", color: "#FFB3D9" },
  { id: "fox",   emoji: "🦊", name: "Fox",   color: "#FFB347" },
  { id: "cat",   emoji: "🐱", name: "Cat",   color: "#B3D9FF" },
  { id: "fairy", emoji: "🧚", name: "Fairy",  color: "#C8B3FF" },
];

const EVENT_CARDS = [
  { icon: "🌪", text: "Windstorm! Both players move back 3 tiles." },
  { icon: "🌸", text: "Cherry Blossom! Both players move forward 3 tiles." },
  { icon: "🎲", text: "Chaos Dice! All players re-roll their position (within 5 tiles)." },
  { icon: "🔀", text: "Mirror World! Swap all players' positions!" },
  { icon: "⏸️", text: "Time Freeze! Current player gets an extra turn." },
  { icon: "🌟", text: "Shooting Star! Trailing player jumps to halfway point." },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function tileToCoord(tile, cols = 8) {
  const idx = tile - 1;
  const row = Math.floor(idx / cols);
  const col = row % 2 === 0 ? idx % cols : cols - 1 - (idx % cols);
  return { row: Math.floor((TOTAL_TILES - 1) / cols) - row, col };
}

function getTileType(tile) {
  if (tile in VINES)   return "vine";
  if (tile in CLOUDS)  return "cloud";
  if (DOUBLE_ROLL.has(tile)) return "double";
  if (SWAP_TILE.has(tile))   return "swap";
  if (FREEZE_TILE.has(tile)) return "freeze";
  if (MYSTERY_TILE.has(tile)) return "mystery";
  return "normal";
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SkyGardenRace() {
  const [phase, setPhase] = useState("setup"); // setup | game | win
  const [players, setPlayers] = useState([
    { id: 0, name: "Player 1", char: null, pos: 0, frozen: 0, shield: false, doubleNext: false },
    { id: 1, name: "Player 2", char: null, pos: 0, frozen: 0, shield: false, doubleNext: false },
  ]);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [diceValue, setDiceValue] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [log, setLog] = useState([]);
  const [round, setRound] = useState(1);
  const [showEvent, setShowEvent] = useState(null);
  const [showMystery, setShowMystery] = useState(null);
  const [tileEffect, setTileEffect] = useState(null); // {tile, type}
  const [winner, setWinner] = useState(null);
  const [animatingPlayer, setAnimatingPlayer] = useState(null);
  const [rollAnim, setRollAnim] = useState(false);
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const addLog = (msg) => setLog(prev => [...prev.slice(-20), msg]);

  const COLS = 8;
  const ROWS = Math.ceil(TOTAL_TILES / COLS);

  // Build board grid
  const boardTiles = [];
  for (let row = ROWS - 1; row >= 0; row--) {
    const rowTiles = [];
    const isEven = (ROWS - 1 - row) % 2 === 0;
    for (let col = 0; col < COLS; col++) {
      const actualCol = isEven ? col : COLS - 1 - col;
      const tileNum = row * COLS + actualCol + 1;
      if (tileNum <= TOTAL_TILES) rowTiles.push(tileNum);
      else rowTiles.push(null);
    }
    boardTiles.push(rowTiles);
  }

  const rollDice = useCallback(() => {
    if (rolling || winner) return;
    const p = players[currentPlayer];
    if (p.frozen > 0) {
      addLog(`❄️ ${p.name} is frozen! Skipping turn...`);
      const np = [...players];
      np[currentPlayer] = { ...p, frozen: p.frozen - 1 };
      setPlayers(np);
      setCurrentPlayer(1 - currentPlayer);
      return;
    }

    setRolling(true);
    setRollAnim(true);
    let count = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.ceil(Math.random() * 6));
      count++;
      if (count >= 10) {
        clearInterval(interval);
        const finalRoll = Math.ceil(Math.random() * 6);
        setDiceValue(finalRoll);
        setRollAnim(false);
        setTimeout(() => processMove(finalRoll), 400);
      }
    }, 80);
  }, [rolling, winner, players, currentPlayer, round]);

  const processMove = (roll) => {
    const np = [...players];
    const p = { ...np[currentPlayer] };
    let newPos = p.pos + roll;

    addLog(`🎲 ${p.name} rolled a ${roll}!`);

    // Win condition: exact roll needed
    if (newPos === TOTAL_TILES) {
      p.pos = TOTAL_TILES;
      np[currentPlayer] = p;
      setPlayers(np);
      setWinner(currentPlayer);
      setPhase("win");
      setRolling(false);
      return;
    }
    if (newPos > TOTAL_TILES) {
      addLog(`⛔ ${p.name} needs exactly ${TOTAL_TILES - p.pos} to win! Stays put.`);
      setRolling(false);
      setCurrentPlayer(1 - currentPlayer);
      return;
    }

    p.pos = newPos;
    setAnimatingPlayer(currentPlayer);

    setTimeout(() => {
      setAnimatingPlayer(null);
      const type = getTileType(newPos);

      if (type === "vine" && !p.shield) {
        const dest = VINES[newPos];
        addLog(`🌸 ${p.name} grabbed a Magic Vine! Soared to tile ${dest}!`);
        p.pos = dest;
        setTileEffect({ tile: dest, type: "vine" });
      } else if (type === "cloud" && !p.shield) {
        const dest = CLOUDS[newPos];
        addLog(`🌪 ${p.name} hit a Mischief Cloud! Fell to tile ${dest}!`);
        p.pos = dest;
        setTileEffect({ tile: dest, type: "cloud" });
      } else if (p.shield && (type === "cloud")) {
        addLog(`🛡️ ${p.name}'s shield blocked the cloud!`);
        p.shield = false;
      } else if (type === "double" || p.doubleNext) {
        addLog(`✨ ${p.name} gets a Double Roll!`);
        const bonus = Math.ceil(Math.random() * 6);
        setDiceValue(bonus);
        addLog(`🎲 Bonus roll: ${bonus}!`);
        p.pos = Math.min(p.pos + bonus, TOTAL_TILES);
        p.doubleNext = false;
        if (p.pos === TOTAL_TILES) {
          np[currentPlayer] = p;
          setPlayers(np);
          setWinner(currentPlayer);
          setPhase("win");
          setRolling(false);
          return;
        }
      } else if (type === "swap") {
        const other = 1 - currentPlayer;
        addLog(`🔄 ${p.name} swapped positions with ${np[other].name}!`);
        const tmp = p.pos;
        p.pos = np[other].pos;
        np[other] = { ...np[other], pos: tmp };
        setTileEffect({ tile: p.pos, type: "swap" });
      } else if (type === "freeze") {
        const other = 1 - currentPlayer;
        addLog(`🧊 ${p.name} froze ${np[other].name} for 1 turn!`);
        np[other] = { ...np[other], frozen: np[other].frozen + 1 };
        setTileEffect({ tile: newPos, type: "freeze" });
      } else if (type === "mystery") {
        const reward = MYSTERY_REWARDS[Math.floor(Math.random() * MYSTERY_REWARDS.length)];
        addLog(`🎁 ${p.name} got a mystery reward: ${reward.text}`);
        if (reward.effect === "boost") p.pos = Math.min(p.pos + 6, TOTAL_TILES);
        if (reward.effect === "shield") p.shield = true;
        if (reward.effect === "doubleNext") p.doubleNext = true;
        if (reward.effect === "vine") {
          const vines = Object.keys(VINES).map(Number).filter(v => v > p.pos);
          if (vines.length) { const nearest = Math.min(...vines); p.pos = VINES[nearest]; }
        }
        setShowMystery(reward);
        setTimeout(() => setShowMystery(null), 2000);
      }

      np[currentPlayer] = p;
      setPlayers(np);

      // Comeback mechanic: trailing player gets small advantage
      const trailing = np[0].pos < np[1].pos ? 0 : 1;
      const gap = Math.abs(np[0].pos - np[1].pos);

      setTimeout(() => {
        setTileEffect(null);

        // Event card every 5 rounds
        const newRound = round + 0.5;
        setRound(newRound);
        if (Number.isInteger(newRound) && newRound % 5 === 0) {
          triggerEventCard(np, currentPlayer);
        } else {
          setCurrentPlayer(1 - currentPlayer);
          setRolling(false);
        }
      }, 600);
    }, 500);
  };

  const triggerEventCard = (np, cp) => {
    // Comeback: if gap > 15, give trailing player a boost event
    const trailing = np[0].pos < np[1].pos ? 0 : 1;
    const gap = Math.abs(np[0].pos - np[1].pos);
    let card;
    if (gap > 15) {
      card = { icon: "🌟", text: "Comeback! The trailing player leaps forward 8 tiles!" };
      np[trailing] = { ...np[trailing], pos: Math.min(np[trailing].pos + 8, TOTAL_TILES - 1) };
      setPlayers([...np]);
    } else {
      card = EVENT_CARDS[Math.floor(Math.random() * EVENT_CARDS.length)];
      // Apply generic effects
      if (card.text.includes("back 3")) {
        np[0] = { ...np[0], pos: Math.max(0, np[0].pos - 3) };
        np[1] = { ...np[1], pos: Math.max(0, np[1].pos - 3) };
      } else if (card.text.includes("forward 3")) {
        np[0] = { ...np[0], pos: Math.min(TOTAL_TILES - 1, np[0].pos + 3) };
        np[1] = { ...np[1], pos: Math.min(TOTAL_TILES - 1, np[1].pos + 3) };
      } else if (card.text.includes("Swap all")) {
        const tmp = np[0].pos; np[0] = { ...np[0], pos: np[1].pos }; np[1] = { ...np[1], pos: tmp };
      }
      setPlayers([...np]);
    }
    setShowEvent(card);
    addLog(`📣 Event: ${card.text}`);
    setTimeout(() => {
      setShowEvent(null);
      setCurrentPlayer(1 - cp);
      setRolling(false);
    }, 2500);
  };

  const resetGame = () => {
    setPhase("setup");
    setPlayers([
      { id: 0, name: "Player 1", char: null, pos: 0, frozen: 0, shield: false, doubleNext: false },
      { id: 1, name: "Player 2", char: null, pos: 0, frozen: 0, shield: false, doubleNext: false },
    ]);
    setCurrentPlayer(0);
    setDiceValue(null);
    setRolling(false);
    setLog([]);
    setRound(1);
    setShowEvent(null);
    setShowMystery(null);
    setTileEffect(null);
    setWinner(null);
  };

  const selectChar = (playerIdx, char) => {
    const np = [...players];
    np[playerIdx] = { ...np[playerIdx], char };
    setPlayers(np);
  };

  const startGame = () => {
    if (!players[0].char || !players[1].char) return;
    if (players[0].char.id === players[1].char.id) return;
    setPhase("game");
    addLog("🌸 Sky Garden Race begins!");
  };

  const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

  const tileColorMap = {
    vine: "from-green-200 to-emerald-300",
    cloud: "from-slate-300 to-blue-200",
    double: "from-yellow-200 to-amber-300",
    swap: "from-purple-200 to-pink-300",
    freeze: "from-cyan-200 to-blue-300",
    mystery: "from-pink-200 to-rose-300",
    normal: "from-white/40 to-white/20",
  };

  const tileBorderMap = {
    vine: "border-emerald-400",
    cloud: "border-blue-400",
    double: "border-amber-400",
    swap: "border-purple-400",
    freeze: "border-cyan-400",
    mystery: "border-pink-400",
    normal: "border-white/30",
  };

  const tileIconMap = {
    vine: "🌸", cloud: "🌪", double: "✨", swap: "🔄", freeze: "🧊", mystery: "🎁", normal: "",
  };

  if (phase === "setup") return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #fce4ff 0%, #d0f0ff 40%, #ffe4f0 80%, #fff0d0 100%)",
      fontFamily: "'Fredoka One', cursive",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes sparkle { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.3)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes glow { 0%,100%{box-shadow:0 0 10px rgba(255,150,200,.4)} 50%{box-shadow:0 0 25px rgba(255,150,200,.9)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes slideIn { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        .float { animation: float 3s ease-in-out infinite; }
        .sparkle { animation: sparkle 2s ease-in-out infinite; }
        .bounce-anim { animation: bounce .6s ease-in-out; }
        .glow-anim { animation: glow 2s ease-in-out infinite; }
        .roll-spin { animation: spin .1s linear; }
        .slide-in { animation: slideIn .4s ease-out; }
        .pulse-anim { animation: pulse 2s ease-in-out infinite; }
      `}</style>
      <div className="float" style={{ fontSize: 70, marginBottom: 8 }}>🌸</div>
      <h1 style={{ fontFamily:"'Fredoka One'",fontSize:42,color:"#c060a0",textShadow:"3px 3px 0 #ffb3d9",margin:"0 0 4px",textAlign:"center" }}>
        Sky Garden
      </h1>
      <h2 style={{ fontFamily:"'Fredoka One'",fontSize:28,color:"#7080e0",textShadow:"2px 2px 0 #c8d0ff",margin:"0 0 28px",textAlign:"center" }}>
        🏆 Race 🏆
      </h2>

      {[0, 1].map(idx => (
        <div key={idx} className="slide-in" style={{
          background: "rgba(255,255,255,0.7)", borderRadius: 24, padding: "20px 24px",
          marginBottom: 16, width: "100%", maxWidth: 360,
          boxShadow: `0 4px 20px ${CHARACTERS[idx]?.color || "#ffb3d9"}66`,
          border: `2px solid ${players[idx].char?.color || "#ffb3d9"}88`,
        }}>
          <div style={{ fontFamily:"'Fredoka One'",fontSize:20,color:"#805090",marginBottom:12 }}>
            {idx === 0 ? "🌷" : "🌊"} Player {idx+1}
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
            {CHARACTERS.map(c => {
              const takenByOther = players[1-idx].char?.id === c.id;
              const selected = players[idx].char?.id === c.id;
              return (
                <button key={c.id} onClick={() => !takenByOther && selectChar(idx, c)} style={{
                  background: selected ? c.color : "rgba(255,255,255,0.6)",
                  border: selected ? `3px solid ${c.color}` : "2px solid rgba(0,0,0,0.1)",
                  borderRadius: 16, padding: "10px 14px", cursor: takenByOther ? "not-allowed" : "pointer",
                  opacity: takenByOther ? 0.3 : 1, fontSize: 28,
                  transform: selected ? "scale(1.15)" : "scale(1)",
                  transition: "all .2s", display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                }}>
                  {c.emoji}
                  <span style={{ fontSize:10, fontFamily:"'Nunito'", fontWeight:700, color:"#805090" }}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button onClick={startGame} disabled={!players[0].char || !players[1].char || players[0].char.id === players[1].char.id}
        className="glow-anim"
        style={{
          marginTop: 8, padding: "18px 48px",
          background: "linear-gradient(135deg, #ff88cc, #aa66ff)",
          color: "white", border: "none", borderRadius: 50, fontSize: 22,
          fontFamily:"'Fredoka One'", cursor:"pointer", letterSpacing:1,
          opacity: (!players[0].char || !players[1].char || players[0].char.id === players[1].char.id) ? 0.4 : 1,
        }}>
        🚀 Start Race!
      </button>
      <p style={{ fontFamily:"'Nunito'",fontSize:12,color:"#a080b0",marginTop:12,textAlign:"center" }}>
        Pick different characters for each player
      </p>
    </div>
  );

  if (phase === "win") {
    const w = players[winner];
    return (
      <div style={{
        minHeight:"100vh", background:"linear-gradient(135deg,#ffe4f8,#d4f0ff,#fff4d0)",
        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
        fontFamily:"'Fredoka One'", padding:20,
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');
          @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
          @keyframes confetti { 0%{transform:translateY(-20px) rotate(0)} 100%{transform:translateY(120vh) rotate(720deg)} }
          .float { animation:float 2s ease-in-out infinite; }
          .confetti-piece { position:fixed; width:10px; height:10px; animation:confetti 3s linear infinite; border-radius:2px; }
        `}</style>
        {["#ff88cc","#ffcc44","#88ddff","#aaffaa","#cc88ff","#ffaa88"].map((c,i) => (
          Array.from({length:5},(_,j) => (
            <div key={`${i}-${j}`} className="confetti-piece" style={{
              background:c, left:`${Math.random()*100}%`, top:0,
              animationDelay:`${Math.random()*3}s`, animationDuration:`${2+Math.random()*2}s`,
            }}/>
          ))
        ))}
        <div className="float" style={{ fontSize:100 }}>{w.char?.emoji}</div>
        <h1 style={{ fontFamily:"'Fredoka One'",fontSize:42,color:"#c060a0",textShadow:"3px 3px 0 #ffb3d9",textAlign:"center",margin:"16px 0 8px" }}>
          {w.name} Wins! 🏆
        </h1>
        <p style={{ fontFamily:"'Nunito'",fontSize:18,color:"#8070c0",marginBottom:24,textAlign:"center" }}>
          Reached the Sky Garden! 🌸✨
        </p>
        <div style={{
          background:"rgba(255,255,255,0.7)", borderRadius:20, padding:"16px 32px",
          marginBottom:24, textAlign:"center",
          boxShadow: `0 4px 20px ${w.char?.color}88`,
        }}>
          <div style={{ fontFamily:"'Nunito'",fontSize:14,color:"#9080b0" }}>Race completed in</div>
          <div style={{ fontFamily:"'Fredoka One'",fontSize:28,color:"#7070d0" }}>{Math.floor(round)} rounds</div>
        </div>
        <button onClick={resetGame} style={{
          padding:"16px 40px", background:"linear-gradient(135deg,#ff88cc,#aa66ff)",
          color:"white", border:"none", borderRadius:50, fontSize:20,
          fontFamily:"'Fredoka One'", cursor:"pointer",
        }}>
          🔄 Play Again!
        </button>
      </div>
    );
  }

  const cp = players[currentPlayer];
  const op = players[1 - currentPlayer];

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(160deg,#e8d4ff 0%,#d0eeff 35%,#fce4ff 65%,#fff0d4 100%)",
      fontFamily:"'Nunito'", padding:"12px 10px 24px", maxWidth:480, margin:"0 auto",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes bounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-10px) scale(1.1)} }
        @keyframes sparkle { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }
        @keyframes glow { 0%,100%{box-shadow:0 0 8px rgba(200,150,255,.5)} 50%{box-shadow:0 0 22px rgba(200,150,255,.9)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes popIn { 0%{transform:scale(0) rotate(-10deg);opacity:0} 80%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes slideDown { from{transform:translateY(-40px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes wiggle { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-5deg)} 75%{transform:rotate(5deg)} }
        .float{animation:float 3s ease-in-out infinite;}
        .bounce-p{animation:bounce .5s ease-in-out;}
        .sparkle{animation:sparkle 1.5s ease-in-out infinite;}
        .glow{animation:glow 2s ease-in-out infinite;}
        .spin{animation:spin .08s linear infinite;}
        .pop-in{animation:popIn .3s cubic-bezier(.34,1.56,.64,1);}
        .slide-down{animation:slideDown .4s ease-out;}
        .wiggle{animation:wiggle .3s ease-in-out 2;}
      `}</style>

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:10 }}>
        <h1 style={{ fontFamily:"'Fredoka One'",fontSize:28,color:"#b060d0",margin:0,textShadow:"2px 2px 0 #e0b0ff" }}>
          🌸 Sky Garden Race
        </h1>
      </div>

      {/* Player Status Cards */}
      <div style={{ display:"flex", gap:8, marginBottom:10 }}>
        {players.map((p, i) => {
          const isActive = i === currentPlayer;
          return (
            <div key={i} className={isActive ? "glow" : ""} style={{
              flex:1, background: isActive ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
              borderRadius:16, padding:"10px 12px",
              border: isActive ? `2px solid ${p.char?.color}` : "2px solid rgba(255,255,255,0.5)",
              transition:"all .3s",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <span style={{ fontSize:22 }}>{p.char?.emoji}</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:13, color: isActive ? "#7050d0" : "#a090c0" }}>{p.name}</div>
                  {isActive && <div style={{ fontSize:10, color:"#ff88cc", fontWeight:700 }}>← YOUR TURN</div>}
                </div>
              </div>
              <div style={{ fontSize:11, color:"#9080b0" }}>
                Tile <strong style={{ color:"#6050c0", fontSize:14 }}>{p.pos}</strong> / {TOTAL_TILES}
              </div>
              <div style={{
                height:5, background:"rgba(0,0,0,0.1)", borderRadius:99, marginTop:4, overflow:"hidden"
              }}>
                <div style={{
                  height:"100%", borderRadius:99,
                  width:`${(p.pos / TOTAL_TILES) * 100}%`,
                  background:`linear-gradient(90deg, ${p.char?.color}, #cc88ff)`,
                  transition:"width .5s ease",
                }}/>
              </div>
              <div style={{ display:"flex", gap:4, marginTop:4 }}>
                {p.frozen > 0 && <span style={{ fontSize:12 }} title="Frozen">❄️</span>}
                {p.shield && <span style={{ fontSize:12 }} title="Shield">🛡️</span>}
                {p.doubleNext && <span style={{ fontSize:12 }} title="Double Next">⭐</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div style={{
        background:"rgba(255,255,255,0.4)", borderRadius:20, padding:8,
        boxShadow:"0 4px 24px rgba(180,120,255,0.2)",
        border:"2px solid rgba(255,255,255,0.6)",
        marginBottom:10,
      }}>
        {boardTiles.map((row, ri) => (
          <div key={ri} style={{ display:"flex", gap:3, marginBottom:3 }}>
            {row.map((tile, ci) => {
              if (!tile) return <div key={ci} style={{ flex:1 }}/>;
              const type = getTileType(tile);
              const isP0 = players[0].pos === tile;
              const isP1 = players[1].pos === tile;
              const isGlowing = tileEffect?.tile === tile;
              const isFinish = tile === TOTAL_TILES;
              const isDark = tile > TOTAL_TILES - 8;

              return (
                <div key={tile} className={isGlowing ? "pop-in" : ""} style={{
                  flex:1, aspectRatio:"1",
                  background: isFinish
                    ? "linear-gradient(135deg,#ffd700,#ffaa00)"
                    : isDark
                    ? `linear-gradient(135deg,${type === "normal" ? "#e0d4ff,#d4c8f0" : ""} ${type !== "normal" ? tileColorMap[type].replace("from-","#").replace(" to-",",#").replace(/[-a-z0-9]+/g, m => {
                        const map = {"green-200":"#bbf7d0","emerald-300":"#6ee7b7","slate-300":"#cbd5e1","blue-200":"#bfdbfe","yellow-200":"#fef08a","amber-300":"#fcd34d","purple-200":"#e9d5ff","pink-300":"#f9a8d4","cyan-200":"#a5f3fc","blue-300":"#93c5fd","pink-200":"#fbcfe8","rose-300":"#fda4af","white/40":"rgba(255,255,255,0.4)","white/20":"rgba(255,255,255,0.2)"};
                        return map[m] || m;
                      }) : ""})`
                    : (() => {
                        const gc = {"from-green-200 to-emerald-300":"#bbf7d0,#6ee7b7","from-slate-300 to-blue-200":"#cbd5e1,#bfdbfe","from-yellow-200 to-amber-300":"#fef08a,#fcd34d","from-purple-200 to-pink-300":"#e9d5ff,#f9a8d4","from-cyan-200 to-blue-300":"#a5f3fc,#93c5fd","from-pink-200 to-rose-300":"#fbcfe8,#fda4af","from-white/40 to-white/20":"rgba(255,255,255,0.5),rgba(255,255,255,0.25)"};
                        const colors = gc[tileColorMap[type]] || "rgba(255,255,255,0.5),rgba(255,255,255,0.25)";
                        return `linear-gradient(135deg,${colors})`;
                      })(),
                  border: `1.5px solid ${isFinish ? "#ffd700" : isGlowing ? "#ff88cc" : "rgba(255,255,255,0.5)"}`,
                  borderRadius:8, position:"relative", display:"flex",
                  alignItems:"center", justifyContent:"center", flexDirection:"column",
                  boxShadow: isGlowing ? "0 0 12px rgba(255,150,200,0.8)" : isFinish ? "0 0 10px rgba(255,215,0,0.5)" : "none",
                  transition:"all .3s",
                  minHeight:0, overflow:"hidden",
                }}>
                  <span style={{ fontSize:"clamp(6px,2.5vw,11px)", lineHeight:1 }}>
                    {isFinish ? "🏆" : tileIconMap[type]}
                  </span>
                  <span style={{ fontSize:"clamp(5px,1.8vw,9px)", color: isDark || isFinish ? "#7050d0" : "#a090c0", fontWeight:700, lineHeight:1 }}>
                    {tile}
                  </span>
                  {/* Player tokens */}
                  <div style={{ position:"absolute", top:1, right:1, display:"flex", gap:1 }}>
                    {isP0 && <span className={animatingPlayer === 0 ? "bounce-p" : ""} style={{ fontSize:"clamp(8px,3vw,14px)", filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>{players[0].char?.emoji}</span>}
                    {isP1 && <span className={animatingPlayer === 1 ? "bounce-p" : ""} style={{ fontSize:"clamp(8px,3vw,14px)", filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>{players[1].char?.emoji}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10, justifyContent:"center" }}>
        {[["🌸","Vine (up)","#bbf7d0"],["🌪","Cloud (dn)","#cbd5e1"],["✨","2x Roll","#fef08a"],["🔄","Swap","#e9d5ff"],["🧊","Freeze","#a5f3fc"],["🎁","Mystery","#fbcfe8"]].map(([ic,lb,bg]) => (
          <div key={lb} style={{ background:bg, borderRadius:99, padding:"3px 8px", fontSize:11, fontWeight:700, color:"#7060a0", display:"flex", gap:4, alignItems:"center" }}>
            <span>{ic}</span><span>{lb}</span>
          </div>
        ))}
      </div>

      {/* Dice & Roll Button */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginBottom:10 }}>
        <div style={{
          width:60, height:60, background:"rgba(255,255,255,0.9)",
          borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:44, boxShadow:"0 4px 16px rgba(180,100,255,0.3)",
          border:"2px solid rgba(200,150,255,0.5)",
        }} className={rollAnim ? "spin" : ""}>
          {diceValue ? DICE_FACES[diceValue] : "🎲"}
        </div>
        <button onClick={rollDice} disabled={rolling} style={{
          padding:"14px 32px",
          background: rolling
            ? "linear-gradient(135deg,#d0c0e0,#c0b0d0)"
            : `linear-gradient(135deg,${cp.char?.color || "#ff88cc"},#aa66ff)`,
          color:"white", border:"none", borderRadius:50, fontSize:18,
          fontFamily:"'Fredoka One'", cursor: rolling ? "not-allowed" : "pointer",
          boxShadow: rolling ? "none" : "0 4px 16px rgba(180,100,255,0.4)",
          transition:"all .2s",
        }}>
          {cp.frozen > 0 ? `❄️ Frozen (${cp.frozen})` : rolling ? "..." : `${cp.char?.emoji} Roll!`}
        </button>
      </div>

      {/* Turn Indicator */}
      <div className="slide-down" style={{
        textAlign:"center", marginBottom:10,
        background:"rgba(255,255,255,0.6)", borderRadius:16, padding:"8px 16px",
        fontFamily:"'Fredoka One'", fontSize:16,
        color: cp.char?.color ? cp.char.color.replace("FF","99").replace("ff","99") : "#b060d0",
        border:"2px solid rgba(255,255,255,0.7)",
      }}>
        {cp.char?.emoji} {cp.name}'s Turn! &nbsp;
        <span style={{ fontSize:12, fontWeight:400, fontFamily:"'Nunito'", color:"#a090c0" }}>
          Round {Math.ceil(round)}
        </span>
      </div>

      {/* Log */}
      <div ref={logRef} style={{
        background:"rgba(255,255,255,0.5)", borderRadius:14, padding:"8px 12px",
        maxHeight:90, overflowY:"auto", fontSize:12, color:"#8070a0",
        fontFamily:"'Nunito'", lineHeight:1.6,
        border:"1px solid rgba(255,255,255,0.6)",
      }}>
        {log.length === 0 ? <span style={{color:"#c0b0d0"}}>Game log will appear here...</span>
          : log.map((l,i) => <div key={i}>{l}</div>)}
      </div>

      {/* Restart */}
      <button onClick={resetGame} style={{
        display:"block", margin:"12px auto 0", padding:"8px 24px",
        background:"rgba(255,255,255,0.6)", color:"#9080c0", border:"2px solid rgba(200,150,255,0.4)",
        borderRadius:50, fontSize:14, fontFamily:"'Fredoka One'", cursor:"pointer",
      }}>
        🔄 Restart
      </button>

      {/* Event Card Overlay */}
      {showEvent && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:100,
        }}>
          <div className="pop-in" style={{
            background:"linear-gradient(135deg,#fff4d0,#ffe4f0)", borderRadius:28,
            padding:"32px 40px", textAlign:"center", maxWidth:300,
            boxShadow:"0 8px 40px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontSize:60, marginBottom:8 }}>{showEvent.icon}</div>
            <div style={{ fontFamily:"'Fredoka One'",fontSize:20,color:"#b060d0",marginBottom:8 }}>✨ Event Card!</div>
            <div style={{ fontFamily:"'Nunito'",fontSize:15,color:"#8070a0" }}>{showEvent.text}</div>
          </div>
        </div>
      )}

      {/* Mystery Overlay */}
      {showMystery && (
        <div style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:100,
        }}>
          <div className="pop-in" style={{
            background:"linear-gradient(135deg,#ffe4ff,#d4e4ff)", borderRadius:28,
            padding:"28px 36px", textAlign:"center", maxWidth:280,
            boxShadow:"0 8px 40px rgba(150,100,255,0.4)",
          }}>
            <div style={{ fontSize:60 }}>{showMystery.icon}</div>
            <div style={{ fontFamily:"'Fredoka One'",fontSize:18,color:"#9050c0",marginTop:8 }}>{showMystery.text}</div>
          </div>
        </div>
      )}
    </div>
  );
}
