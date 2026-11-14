const nodes = [
  { x: 260, y: 36, label: "Cụ Khải", tone: "gold" },
  { x: 400, y: 36, label: "Cụ Hoa", tone: "rose" },
  { x: 135, y: 154, label: "Ông Minh", tone: "green" },
  { x: 330, y: 154, label: "Ông An", tone: "gold" },
  { x: 525, y: 154, label: "Bà Lan", tone: "rose" },
  { x: 68, y: 276, label: "Bác Thành", tone: "green" },
  { x: 200, y: 276, label: "Cô Mai", tone: "rose" },
  { x: 330, y: 276, label: "Chú Dũng", tone: "gold" },
  { x: 465, y: 276, label: "Cô Ngọc", tone: "rose" },
  { x: 598, y: 276, label: "Chú Nam", tone: "green" }
];

export function HeroTree() {
  return (
    <div className="hero-tree" aria-label="Minh họa cây gia phả bốn thế hệ">
      <svg viewBox="0 0 700 380" role="img" aria-label="Minh họa cây gia phả bốn thế hệ">
        <defs>
          <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="1" stopColor="#f3e4c5" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#552619" floodOpacity=".16" />
          </filter>
        </defs>
        <path className="tree-line" d="M300 88h60M330 88v43M135 131h390M135 131v23M330 131v23M525 131v23" />
        <path className="tree-line" d="M135 206v32M68 238h132M68 238v38M200 238v38" />
        <path className="tree-line" d="M330 206v70M525 206v32M465 238h133M465 238v38M598 238v38" />
        {nodes.map((node) => (
          <g key={node.label} transform={`translate(${node.x - 60} ${node.y})`} filter="url(#softShadow)">
            <rect className={`tree-node tree-node-${node.tone}`} width="120" height="52" rx="15" />
            <circle className="tree-node-dot" cx="17" cy="17" r="5" />
            <text x="60" y="31" textAnchor="middle">
              {node.label}
            </text>
          </g>
        ))}
      </svg>
      <span className="hero-tree-badge">4 thế hệ · 16 thành viên</span>
    </div>
  );
}
