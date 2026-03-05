import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import { NavConnectWallet } from "../components/NavConnectWallet";
import { useRecentEvents } from "../hooks/useOnChainData";

const ACCENT = "#FF3366";
const ACCENT2 = "#FF6B9D";
const BG = "#09090B";
const SURFACE = "#131316";
const SURFACE2 = "#1A1A1F";
const BORDER = "#2A2A30";
const TEXT = "#E4E4E7";
const TEXT_DIM = "#71717A";

const FONT_HEAD = "'Orbitron', sans-serif";
const FONT_BODY = "'Space Mono', monospace";
const FONT_CODE = "'SF Mono', 'Cascadia Code', 'Fira Code', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

// Animated geometric background
function GeometricBG() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ opacity: 0.04 }}>
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#fff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          width: 300 + i * 80, height: 300 + i * 80,
          border: `1px solid rgba(255,51,102,${0.03 + i * 0.008})`,
          borderRadius: "50%",
          top: `${10 + i * 12}%`,
          left: `${50 + (i % 2 === 0 ? -20 : 20)}%`,
          transform: "translate(-50%, -50%)",
          animation: `float ${12 + i * 3}s ease-in-out infinite alternate`,
        }} />
      ))}
      {[...Array(4)].map((_, i) => (
        <div key={`sq-${i}`} style={{
          position: "absolute",
          width: 120 + i * 40, height: 120 + i * 40,
          border: `1px solid rgba(255,107,157,0.04)`,
          top: `${20 + i * 20}%`,
          left: `${10 + i * 22}%`,
          transform: `rotate(${45 + i * 15}deg)`,
          animation: `spin ${30 + i * 10}s linear infinite`,
        }} />
      ))}
    </div>
  );
}


function Diamond({ size = 40, color = ACCENT, delay = 0 }: { size?: number; color?: string; delay?: number }) {
  return (
    <div style={{
      width: size, height: size,
      border: `1.5px solid ${color}`,
      transform: "rotate(45deg)",
      animation: `pulse 3s ease-in-out ${delay}s infinite`,
      flexShrink: 0,
    }} />
  );
}

function NavBar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navItems = [
    { label: "Registry", path: "/registry" },
    { label: "Developers", path: "/developers" },
    { label: "Auditors", path: "/auditors" },
    { label: "Docs", path: "/docs" },
  ];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
      background: scrolled ? "rgba(9,9,11,0.85)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent",
      transition: "all 0.3s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate("/")}>
        <div style={{
          width: 28, height: 28, border: `2px solid ${ACCENT}`, borderRadius: 4,
          transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 8, height: 8, background: ACCENT, borderRadius: 1 }} />
        </div>
        <span style={{ fontFamily: FONT_HEAD, fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: "-0.02em" }}>
          AEGIS
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        {navItems.map(item => (
          <a key={item.label} href={`#${item.path}`} style={{
            color: TEXT_DIM, textDecoration: "none", fontSize: 13, fontFamily: FONT_BODY,
            fontWeight: 400, transition: "color 0.2s", cursor: "pointer",
          }}
            onMouseEnter={e => (e.target as HTMLElement).style.color = TEXT}
            onMouseLeave={e => (e.target as HTMLElement).style.color = TEXT_DIM}
            onClick={e => { e.preventDefault(); navigate(item.path); }}
          >{item.label}</a>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: -8 }}>
          <a href="https://github.com/aegisaudit/aegis" target="_blank" rel="noopener noreferrer" title="GitHub"
            style={{ color: TEXT_DIM, transition: "color 0.2s", display: "flex" }}
            onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <a href="https://www.npmjs.com/package/@aegisaudit/sdk" target="_blank" rel="noopener noreferrer" title="npm"
            style={{ color: TEXT_DIM, transition: "color 0.2s", display: "flex" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#CB3837")}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}>
            <svg width="20" height="18" viewBox="0 0 256 256" fill="currentColor"><path d="M0 256V0h256v256H0zm49.6-49.6h46.4V92.8H128v113.6h32V46.4H49.6v160z"/></svg>
          </a>
        </div>
        <NavConnectWallet />
      </div>
    </nav>
  );
}

function QuickStartWindow() {
  const [copied, setCopied] = useState<number | null>(null);
  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };
  const lines: { prefix: string; cmd: string; comment: string | null; spaceBefore?: boolean }[] = [
    { prefix: "", cmd: "", comment: "# Install the MCP server for Claude, Cursor, etc.", spaceBefore: false },
    { prefix: "$", cmd: "npx @aegisaudit/mcp-server setup", comment: null },
    { prefix: "", cmd: "", comment: "" },
    { prefix: "", cmd: "", comment: "# ◆ AEGIS Protocol — MCP Server Setup", spaceBefore: true },
    { prefix: "", cmd: '//   ✓ Claude Desktop — configured', comment: null },
    { prefix: "", cmd: '//   ✓ Cursor — configured', comment: null },
    { prefix: "", cmd: '//   Done! Restart your AI client.', comment: null },
    { prefix: "", cmd: "", comment: "" },
    { prefix: "", cmd: "", comment: "# Or use the SDK directly in your agent", spaceBefore: true },
    { prefix: "$", cmd: "npm install @aegisaudit/sdk", comment: null },
    { prefix: ">", cmd: 'import { AegisClient } from "@aegisaudit/sdk";', comment: null },
    { prefix: ">", cmd: "const aegis = new AegisClient({ chainId: 8453 });", comment: null },
    { prefix: ">", cmd: "const skills = await aegis.listAllSkills();", comment: null },
  ];
  return (
    <div style={{
      maxWidth: 680, width: "100%", margin: "0 auto",
      animation: "fadeInUp 0.8s ease 0.6s both",
    }}>
      <div style={{
        background: "#0D0D10", border: `1px solid ${BORDER}`,
        borderRadius: 12, overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 60px rgba(255,51,102,0.04)",
      }}>
        {/* macOS title bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: `1px solid ${BORDER}`,
          background: "rgba(19,19,22,0.95)",
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F57" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FEBC2E" }} />
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28C840" }} />
          </div>
          <span style={{ fontFamily: FONT_CODE, fontSize: 12, color: TEXT_DIM }}>
            quickstart &mdash; zsh
          </span>
          <div style={{ width: 52 }} />
        </div>
        {/* Terminal content */}
        <div style={{ padding: "20px 24px", fontFamily: FONT_CODE, fontSize: 13.5, lineHeight: 1.7 }}>
          {lines.map((line, i) => {
            if (line.comment !== null) {
              return (
                <div key={i} style={{
                  color: "#6B7280",
                  minHeight: line.comment === "" ? "0.6em" : "1.5em",
                  marginTop: line.spaceBefore ? 12 : 0,
                  fontFamily: FONT_CODE,
                }}>
                  {line.comment}
                </div>
              );
            }
            const isInstall = line.prefix === "$";
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 0, minHeight: "1.5em",
                position: "relative",
              }}
                onMouseEnter={e => {
                  const btn = e.currentTarget.querySelector("[data-copy]") as HTMLElement;
                  if (btn) btn.style.opacity = "1";
                }}
                onMouseLeave={e => {
                  const btn = e.currentTarget.querySelector("[data-copy]") as HTMLElement;
                  if (btn) btn.style.opacity = "0";
                }}
              >
                <span style={{ color: isInstall ? ACCENT : "#6B7280", marginRight: 8, userSelect: "none" }}>
                  {line.prefix}
                </span>
                {isInstall ? (
                  <span>
                    <span style={{ color: "#A1A1AA" }}>npm install </span>
                    <span style={{ color: "#4ADE80", fontWeight: 700 }}>@aegisaudit/sdk</span>
                  </span>
                ) : (
                  <span style={{ color: "#A1A1AA" }}>
                    {line.cmd.startsWith("//") ? (
                      <span style={{ color: "#4B5563" }}>{line.cmd}</span>
                    ) : (
                      <>
                        {line.cmd.split(/(\b(?:import|from|const|await|new)\b|[{}])/g).map((part, j) =>
                          ["import", "from", "const", "await", "new"].includes(part) ? (
                            <span key={j} style={{ color: "#C084FC" }}>{part}</span>
                          ) : ["{", "}"].includes(part) ? (
                            <span key={j} style={{ color: "#FBBF24" }}>{part}</span>
                          ) : part.includes('"') || part.includes("'") ? (
                            <span key={j} style={{ color: "#4ADE80" }}>{part}</span>
                          ) : (
                            <span key={j}>{part}</span>
                          )
                        )}
                      </>
                    )}
                  </span>
                )}
                {isInstall && (
                  <button
                    data-copy=""
                    onClick={() => handleCopy(line.cmd, i)}
                    style={{
                      position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                      background: copied === i ? "rgba(74,222,128,0.15)" : "rgba(42,42,48,0.9)",
                      border: `1px solid ${copied === i ? "rgba(74,222,128,0.3)" : BORDER}`,
                      borderRadius: 4, padding: "2px 8px",
                      fontSize: 10, fontFamily: FONT_CODE,
                      color: copied === i ? "#4ADE80" : TEXT_DIM,
                      cursor: "pointer", opacity: 0, transition: "opacity 0.15s",
                    }}
                  >
                    {copied === i ? "\u2713" : "copy"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  return (
    <section style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center",
      position: "relative", padding: "100px 24px 60px",
    }}>
      <div style={{
        position: "absolute", top: "15%", left: "50%", transform: "translate(-50%, -50%)",
        width: 800, height: 800,
        background: `radial-gradient(circle, rgba(255,51,102,0.06) 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "6px 16px", borderRadius: 20, border: `1px solid ${BORDER}`,
        marginBottom: 28, background: "rgba(255,51,102,0.04)",
        animation: "fadeInUp 0.8s ease forwards",
      }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, animation: "pulse 2s infinite" }} />
        <span style={{ color: ACCENT, fontSize: 12, fontFamily: FONT_BODY, fontWeight: 400 }}>
          Protocol Live on Base
        </span>
      </div>
      <h1 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(36px, 5vw, 64px)",
        fontWeight: 800, color: TEXT, lineHeight: 1.1, maxWidth: 800,
        letterSpacing: "-0.02em", margin: "0 0 20px",
        animation: "fadeInUp 0.8s ease 0.1s both",
      }}>
        Trust every skill{" "}
        <span style={{
          background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          your agents run
        </span>
      </h1>
      <p style={{
        fontFamily: FONT_BODY, fontSize: 15, color: TEXT_DIM,
        maxWidth: 540, lineHeight: 1.7, margin: "0 0 32px",
        animation: "fadeInUp 0.8s ease 0.2s both",
      }}>
        The on-chain attestation registry for AI agent skills. Cryptographically verified.
        Zero knowledge. Zero trust required.
      </p>
      <div style={{ display: "flex", gap: 14, animation: "fadeInUp 0.8s ease 0.3s both" }}>
        <button style={{
          background: ACCENT, color: BG, border: "none", borderRadius: 8,
          padding: "14px 32px", fontSize: 14, fontWeight: 700, cursor: "pointer",
          fontFamily: FONT_BODY,
        }} onClick={() => navigate("/registry")}>Explore Registry</button>
        <button style={{
          background: "transparent", color: TEXT, border: `1px solid ${BORDER}`,
          borderRadius: 8, padding: "14px 32px", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: FONT_BODY, transition: "border-color 0.2s",
        }}
          onMouseEnter={e => (e.target as HTMLElement).style.borderColor = ACCENT}
          onMouseLeave={e => (e.target as HTMLElement).style.borderColor = BORDER}
          onClick={() => navigate("/docs")}
        >Read Docs &rarr;</button>
      </div>
      <div style={{
        display: "flex", gap: 20, alignItems: "center", marginTop: 48,
        marginBottom: 48,
        animation: "fadeInUp 0.8s ease 0.5s both",
      }}>
        <Diamond size={12} color={ACCENT} delay={0} />
        <Diamond size={18} color={ACCENT2} delay={0.5} />
        <Diamond size={24} color={ACCENT} delay={1} />
        <Diamond size={18} color={ACCENT2} delay={1.5} />
        <Diamond size={12} color={ACCENT} delay={2} />
      </div>
      <QuickStartWindow />
    </section>
  );
}


function FeatureCard({ title, description, icon, index }: { title: string; description: string; icon: React.ReactNode; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? SURFACE2 : SURFACE,
        border: `1px solid ${hovered ? ACCENT + "40" : BORDER}`,
        borderRadius: 12, padding: 36, position: "relative", overflow: "hidden",
        transition: "all 0.3s ease", cursor: "default",
      }}
    >
      <div style={{
        position: "absolute", top: -20, right: -20, opacity: hovered ? 0.08 : 0.03,
        transition: "opacity 0.3s ease",
      }}>
        {icon}
      </div>
      <div style={{
        fontFamily: FONT_BODY, fontSize: 12,
        color: ACCENT, marginBottom: 16, fontWeight: 400,
      }}>0{index + 1}</div>
      <h3 style={{
        fontFamily: FONT_HEAD, fontSize: 20,
        fontWeight: 700, color: TEXT, margin: "0 0 12px", letterSpacing: "-0.01em",
      }}>{title}</h3>
      <p style={{
        fontFamily: FONT_BODY, fontSize: 14,
        color: TEXT_DIM, lineHeight: 1.65, margin: 0,
      }}>{description}</p>
    </div>
  );
}

function Features() {
  const features = [
    {
      title: "ZK Attestations",
      description: "Skills are proven safe through zero-knowledge proofs. The code, the auditor, and the publisher all stay private. Only the trust signal is public.",
      icon: <svg width="140" height="140" viewBox="0 0 140 140"><polygon points="70,10 130,40 130,100 70,130 10,100 10,40" fill="none" stroke={ACCENT} strokeWidth="1" /></svg>,
    },
    {
      title: "Auditor Registry",
      description: "Anonymous auditors stake tokens behind their attestations. Persistent reputation tracked by commitment \u2014 not identity. Bad audits get slashed.",
      icon: <svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="55" fill="none" stroke={ACCENT2} strokeWidth="1" /><circle cx="70" cy="70" r="35" fill="none" stroke={ACCENT2} strokeWidth="1" /></svg>,
    },
    {
      title: "Tiered Audit Levels",
      description: "Level 1 basic safety. Level 2 standard with input validation. Level 3 comprehensive with formal verification. Choose the trust level you need.",
      icon: <svg width="140" height="140" viewBox="0 0 140 140"><rect x="20" y="20" width="100" height="100" fill="none" stroke={ACCENT} strokeWidth="1" transform="rotate(15 70 70)" /><rect x="35" y="35" width="70" height="70" fill="none" stroke={ACCENT} strokeWidth="1" transform="rotate(30 70 70)" /></svg>,
    },
    {
      title: "Dispute Resolution",
      description: "Found a malicious skill? Submit a dispute with evidence. If the auditor was negligent, their stake gets slashed. Accountability without identity.",
      icon: <svg width="140" height="140" viewBox="0 0 140 140"><line x1="20" y1="120" x2="70" y2="20" stroke={ACCENT2} strokeWidth="1" /><line x1="70" y1="20" x2="120" y2="120" stroke={ACCENT2} strokeWidth="1" /><line x1="20" y1="120" x2="120" y2="120" stroke={ACCENT2} strokeWidth="1" /></svg>,
    },
  ];
  return (
    <section style={{ padding: "100px 40px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{
            fontFamily: FONT_BODY, fontSize: 12,
            color: ACCENT, marginBottom: 12, textTransform: "uppercase",
            letterSpacing: "0.12em", fontWeight: 400,
          }}>Protocol Primitives</div>
          <h2 style={{
            fontFamily: FONT_BODY, fontSize: 34,
            fontWeight: 700, color: TEXT, letterSpacing: "-0.01em", margin: 0,
          }}>Four pillars of skill trust</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {features.map((f, i) => (
            <FeatureCard key={i} index={i} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Three.js Globe Section
function GlobeSection() {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const canvasHeight = 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / canvasHeight, 0.1, 1000);
    camera.position.set(0, 0, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, canvasHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    globeGroup.position.y = -0.15;
    globeGroup.rotation.x = 0.3;
    scene.add(globeGroup);

    // Dot sphere — 800 Fibonacci points
    const dotCount = 800;
    const positions = new Float32Array(dotCount * 3);
    const sizes = new Float32Array(dotCount);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < dotCount; i++) {
      const y = 1 - (i / (dotCount - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      positions[i * 3] = Math.cos(theta) * radius * 1.2;
      positions[i * 3 + 1] = y * 1.2;
      positions[i * 3 + 2] = Math.sin(theta) * radius * 1.2;
      sizes[i] = 0.8 + Math.random() * 0.6;
    }

    const dotGeom = new THREE.BufferGeometry();
    dotGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    dotGeom.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const dotMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        attribute float size;
        varying float vAlpha;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (40.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
          vec3 viewDir = normalize(-mvPosition.xyz);
          vec3 normal = normalize(normalMatrix * normalize(position));
          float fresnel = dot(viewDir, normal);
          vAlpha = smoothstep(0.0, 0.4, fresnel) * 0.5;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float a = smoothstep(0.5, 0.3, d);
          gl_FragColor = vec4(1.0, 0.42, 0.62, a * vAlpha);
        }
      `,
    });

    const dots = new THREE.Points(dotGeom, dotMat);
    globeGroup.add(dots);

    // Wireframe rings
    for (let i = 0; i < 5; i++) {
      const ringGeom = new THREE.RingGeometry(1.195 + i * 0.001, 1.205 + i * 0.001, 80);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xFF6B9D, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.rotation.x = Math.random() * Math.PI;
      ring.rotation.y = Math.random() * Math.PI;
      globeGroup.add(ring);
    }

    // Agent nodes
    const agentColors = [0xFF3366, 0xFF6B9D, 0xffffff];
    const agentPositions: THREE.Vector3[] = [];
    const agents: THREE.Mesh[] = [];

    for (let i = 0; i < 18; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / 18);
      const theta = goldenAngle * i * 7;
      const x = Math.sin(phi) * Math.cos(theta) * 1.2;
      const y = Math.cos(phi) * 1.2;
      const z = Math.sin(phi) * Math.sin(theta) * 1.2;

      const nodeGeom = new THREE.SphereGeometry(0.022, 8, 8);
      const nodeMat = new THREE.MeshBasicMaterial({
        color: agentColors[i % 3],
        transparent: true, opacity: 0.9,
      });
      const node = new THREE.Mesh(nodeGeom, nodeMat);
      node.position.set(x, y, z);
      globeGroup.add(node);
      agents.push(node);
      agentPositions.push(new THREE.Vector3(x, y, z));

      // Glow ring
      const glowGeom = new THREE.RingGeometry(0.025, 0.045, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: agentColors[i % 3],
        transparent: true, opacity: 0.2, side: THREE.DoubleSide,
      });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      glow.position.copy(node.position);
      glow.lookAt(0, 0, 0);
      globeGroup.add(glow);
    }

    // Connection lines
    const lineMat = new THREE.LineBasicMaterial({ color: 0xFF3366, transparent: true, opacity: 0.12 });
    for (let i = 0; i < agentPositions.length; i++) {
      for (let j = i + 1; j < agentPositions.length; j++) {
        if (agentPositions[i].distanceTo(agentPositions[j]) < 1.5) {
          const lineGeom = new THREE.BufferGeometry().setFromPoints([agentPositions[i], agentPositions[j]]);
          const line = new THREE.Line(lineGeom, lineMat);
          globeGroup.add(line);
        }
      }
    }

    let time = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.003;
      globeGroup.rotation.y = time * 0.5;

      agents.forEach((agent, i) => {
        const s = 1 + Math.sin(time * 2 + i) * 0.3;
        agent.scale.setScalar(s);
      });

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      camera.aspect = w / canvasHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(w, canvasHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section style={{
      padding: "36px 40px 0", position: "relative", zIndex: 1,
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <div style={{
          fontFamily: FONT_BODY, fontSize: 12,
          color: ACCENT, marginBottom: 12, textTransform: "uppercase",
          letterSpacing: "0.12em", fontWeight: 400,
        }}>Global Network</div>
        <h2 style={{
          fontFamily: FONT_HEAD, fontSize: 38,
          fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", margin: "0 0 12px",
        }}>Agents trust skills worldwide</h2>
        <p style={{
          fontFamily: FONT_BODY, fontSize: 14, color: TEXT_DIM,
          lineHeight: 1.7, maxWidth: 480, margin: "0 auto 16px",
        }}>
          Every node is an agent. Every line is a verified attestation. Trust propagates across the network.
        </p>
        <div
          ref={mountRef}
          style={{
            width: "100%", height: 300, overflow: "hidden",
            borderRadius: 12,
          }}
        />
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { role: "Publisher", action: "Submits skill hash + selects audit level", detail: "keccak256(skill_package) \u2192 on-chain" },
    { role: "Auditor", action: "Runs security analysis, generates ZK proof", detail: "Proves code passed criteria without revealing source" },
    { role: "Registry", action: "Stores attestation with bonded stake", detail: "Proof + auditor commitment + stake amount" },
    { role: "Consumer", action: "Verifies attestation before running skill", detail: "On-chain proof verification in a single call" },
  ];
  return (
    <section style={{
      padding: "100px 40px", position: "relative", zIndex: 1,
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 56, textAlign: "center" }}>
          <div style={{
            fontFamily: FONT_BODY, fontSize: 12,
            color: ACCENT2, marginBottom: 12, textTransform: "uppercase",
            letterSpacing: "0.12em", fontWeight: 400,
          }}>How It Works</div>
          <h2 style={{
            fontFamily: FONT_HEAD, fontSize: 38,
            fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", margin: 0,
          }}>From skill to trust signal</h2>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {steps.map((step, i) => (
            <div key={i} style={{
              flex: 1, padding: "32px 24px", background: SURFACE,
              borderRadius: i === 0 ? "12px 0 0 12px" : i === 3 ? "0 12px 12px 0" : 0,
              borderRight: i < 3 ? `1px solid ${BORDER}` : "none",
              position: "relative",
            }}>
              <div style={{
                fontFamily: FONT_BODY, fontSize: 11,
                color: BG, background: ACCENT, display: "inline-block",
                padding: "2px 8px", borderRadius: 4, marginBottom: 16, fontWeight: 700,
              }}>{step.role}</div>
              <div style={{
                fontFamily: FONT_BODY, fontSize: 15,
                fontWeight: 700, color: TEXT, marginBottom: 8, lineHeight: 1.4,
              }}>{step.action}</div>
              <div style={{
                fontFamily: FONT_BODY, fontSize: 11,
                color: TEXT_DIM, lineHeight: 1.5,
              }}>{step.detail}</div>
              {i < 3 && (
                <div style={{
                  position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)",
                  color: ACCENT, fontSize: 16, zIndex: 2, fontWeight: 700,
                }}>&rarr;</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CodeBlock() {
  const code = [
    "import { AegisClient } from '@aegisaudit/sdk';",
    "",
    "const aegis = new AegisClient({ chainId: 8453 });",
    "",
    "// Discover all attested skills on the registry",
    "const skills = await aegis.listAllSkills();",
    "",
    "// Verify a skill before your agent runs it",
    "const atts = await aegis.getAttestations(skillHash);",
    "if (atts[0]?.auditLevel >= 2) {",
    "  agent.loadSkill(skillHash); // safe to run",
    "}",
  ].join("\n");
  return (
    <section style={{
      padding: "100px 40px", position: "relative", zIndex: 1,
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center",
      }}>
        <div>
          <div style={{
            fontFamily: FONT_BODY, fontSize: 12,
            color: ACCENT, marginBottom: 12, textTransform: "uppercase",
            letterSpacing: "0.12em", fontWeight: 400,
          }}>Developer Experience</div>
          <h2 style={{
            fontFamily: FONT_HEAD, fontSize: 34,
            fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", margin: "0 0 16px",
          }}>npm install, verify, done</h2>
          <p style={{
            fontFamily: FONT_BODY, fontSize: 14,
            color: TEXT_DIM, lineHeight: 1.7, margin: 0,
          }}>
            Drop-in TypeScript SDK. Discover skills, check attestation level, verify ZK proofs,
            and query auditor reputation &mdash; all from a single client. Available now on npm as <span style={{ color: "#4ADE80" }}>@aegisaudit/sdk</span>.
          </p>
        </div>
        <div style={{
          background: "#0D0D10", border: `1px solid ${BORDER}`,
          borderRadius: 12, overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "12px 16px", borderBottom: `1px solid ${BORDER}`,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF5F57" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FEBC2E" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#FF3366" }} />
            <span style={{ marginLeft: 10, fontFamily: FONT_CODE, fontSize: 11, color: TEXT_DIM }}>agent.ts</span>
          </div>
          <pre style={{
            padding: "20px 20px", margin: 0, overflow: "auto",
            fontFamily: FONT_CODE, fontSize: 13.5, lineHeight: 1.7, color: "#A1A1AA",
          }}>
            {code.split("\n").map((line, i) => (
              <div key={i}>
                {line.includes("//") ? (
                  <span style={{ color: "#4B5563" }}>{line}</span>
                ) : line.includes("const") ? (
                  <span><span style={{ color: "#C084FC" }}>const</span><span>{line.replace("const", "")}</span></span>
                ) : line.includes("if") ? (
                  <span><span style={{ color: "#C084FC" }}>if</span><span>{line.replace("if", "")}</span></span>
                ) : line.includes("await") ? (
                  <span><span style={{ color: "#C084FC" }}>await</span><span>{line.replace("await", "")}</span></span>
                ) : (
                  <span>{line}</span>
                )}
              </div>
            ))}
          </pre>
        </div>
      </div>
    </section>
  );
}

function LiveFeed() {
  const { events, loading } = useRecentEvents(8);
  const typeColors: Record<string, string> = {
    LISTED: "#A78BFA", ATTESTED: ACCENT, STAKED: "#60A5FA", DISPUTE: "#F87171",
  };
  return (
    <section style={{
      padding: "100px 40px", position: "relative", zIndex: 1,
      borderTop: `1px solid ${BORDER}`,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{
              fontFamily: FONT_BODY, fontSize: 12,
              color: ACCENT, marginBottom: 12, textTransform: "uppercase",
              letterSpacing: "0.12em", fontWeight: 400,
            }}>Live Activity</div>
            <h2 style={{
              fontFamily: FONT_HEAD, fontSize: 34,
              fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", margin: 0,
            }}>Registry feed</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: ACCENT,
              animation: "pulse 2s infinite",
            }} />
            <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: TEXT_DIM }}>
              {loading ? "Syncing\u2026" : `${events.length} events`}
            </span>
          </div>
        </div>
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden",
        }}>
          <div style={{
            display: "grid", gridTemplateColumns: "100px 1fr 80px 140px 80px",
            padding: "12px 24px", borderBottom: `1px solid ${BORDER}`,
            fontFamily: FONT_BODY, fontSize: 11,
            color: TEXT_DIM, textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            <span>Event</span><span>Skill</span><span>Level</span><span>Auditor</span><span>Time</span>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 24px" }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM, animation: "pulse 2s infinite" }}>
                Loading on-chain events&hellip;
              </div>
            </div>
          ) : events.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 24px" }}>
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: TEXT_DIM }}>
                No events found yet
              </div>
            </div>
          ) : (
            events.map((e, i) => (
              <div key={`${e.type}-${e.txHash}-${i}`} style={{
                display: "grid", gridTemplateColumns: "100px 1fr 80px 140px 80px",
                padding: "14px 24px", borderBottom: i < events.length - 1 ? `1px solid ${BORDER}` : "none",
                fontFamily: FONT_BODY, fontSize: 13,
                animation: `fadeInUp 0.5s ease ${i * 0.08}s both`,
                transition: "background 0.15s",
                cursor: "pointer",
              }}
                onClick={() => window.open(`https://basescan.org/tx/${e.txHash}`, "_blank")}
                onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = SURFACE2}
                onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <span style={{
                  color: typeColors[e.type] || TEXT_DIM, fontWeight: 700, fontSize: 11,
                  background: (typeColors[e.type] || TEXT_DIM) + "15", padding: "2px 8px",
                  borderRadius: 4, display: "inline-block", width: "fit-content",
                }}>{e.type}</span>
                <span style={{ color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.skill}</span>
                <span style={{ color: e.level > 0 ? TEXT_DIM : "transparent" }}>
                  {"\u25CF".repeat(e.level)}{"\u25CB".repeat(Math.max(0, 3 - e.level))}
                </span>
                <span style={{ color: TEXT_DIM }}>{e.amount || e.auditor}</span>
                <span style={{ color: TEXT_DIM }}>{e.time}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  const navigate = useNavigate();
  return (
    <section style={{
      padding: "120px 40px", position: "relative", zIndex: 1,
      borderTop: `1px solid ${BORDER}`, textAlign: "center",
    }}>
      <div style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: 600, height: 600,
        background: `radial-gradient(circle, rgba(255,51,102,0.05) 0%, transparent 60%)`,
        pointerEvents: "none",
      }} />
      <h2 style={{
        fontFamily: FONT_HEAD, fontSize: "clamp(28px, 3.5vw, 44px)",
        fontWeight: 800, color: TEXT, letterSpacing: "-0.02em", margin: "0 0 16px",
        position: "relative",
      }}>
        Build trust into the agent stack
      </h2>
      <p style={{
        fontFamily: FONT_BODY, fontSize: 14,
        color: TEXT_DIM, maxWidth: 480, margin: "0 auto 36px", lineHeight: 1.7,
      }}>
        Whether you're a publisher, auditor, or marketplace &mdash; AEGIS gives every skill a verifiable trust signal.
      </p>
      <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
        <button style={{
          background: ACCENT, color: BG, border: "none", borderRadius: 8,
          padding: "16px 36px", fontSize: 14, fontWeight: 700, cursor: "pointer",
          fontFamily: FONT_BODY,
        }} onClick={() => navigate("/app")}>Start Building &rarr;</button>
        <button style={{
          background: "transparent", color: TEXT, border: `1px solid ${BORDER}`,
          borderRadius: 8, padding: "16px 36px", fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: FONT_BODY,
        }} onClick={() => window.open("https://github.com/aegisaudit/aegis", "_blank")}>View on GitHub</button>
      </div>
    </section>
  );
}

function Footer() {
  const navigate = useNavigate();

  const linkStyle = {
    display: "block", fontFamily: FONT_BODY,
    fontSize: 12, color: TEXT_DIM, textDecoration: "none",
    padding: "4px 0", transition: "color 0.15s", cursor: "pointer",
  } as const;

  const cols = [
    {
      title: "Protocol",
      items: [
        { label: "Registry", onClick: () => navigate("/registry") },
        { label: "Auditors", onClick: () => navigate("/auditors") },
        { label: "Documentation", onClick: () => navigate("/docs") },
        { label: "Launch App", onClick: () => navigate("/app") },
      ],
    },
    {
      title: "Developers",
      items: [
        { label: "SDK Reference", onClick: () => navigate("/developers") },
        { label: "GitHub", href: "https://github.com/aegisaudit/aegis" },
        { label: "npm Package", href: "https://www.npmjs.com/package/@aegisaudit/sdk" },
      ],
    },
    {
      title: "Resources",
      items: [
        { label: "Base Explorer", href: "https://basescan.org/address/0xBED52D8CEe2690900e21e5ffcb988DFF728D7E1D" },
        { label: "ERC-8004", href: "https://eips.ethereum.org/EIPS/eip-8004" },
      ],
    },
  ];

  return (
    <footer style={{
      padding: "60px 40px 40px", borderTop: `1px solid ${BORDER}`,
      position: "relative", zIndex: 1,
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        display: "grid", gridTemplateColumns: "1.5fr repeat(3, 1fr)", gap: 60,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, cursor: "pointer" }} onClick={() => navigate("/")}>
            <div style={{
              width: 24, height: 24, border: `2px solid ${ACCENT}`, borderRadius: 3,
              transform: "rotate(45deg)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 6, height: 6, background: ACCENT, borderRadius: 1 }} />
            </div>
            <span style={{ fontFamily: FONT_HEAD, fontSize: 16, fontWeight: 700, color: TEXT }}>AEGIS</span>
          </div>
          <p style={{
            fontFamily: FONT_BODY, fontSize: 12,
            color: TEXT_DIM, lineHeight: 1.7, maxWidth: 240,
          }}>
            Anonymous expertise & guarantee for intelligent skills. Trust the proof, not the publisher.
          </p>
        </div>
        {cols.map((col, i) => (
          <div key={i}>
            <div style={{
              fontFamily: FONT_BODY, fontSize: 13,
              fontWeight: 700, color: TEXT, marginBottom: 16,
            }}>{col.title}</div>
            {col.items.map((item, j) => (
              "href" in item ? (
                <a key={j} href={item.href} target="_blank" rel="noopener noreferrer" style={linkStyle}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = TEXT}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = TEXT_DIM}
                >{item.label}</a>
              ) : (
                <a key={j} href="#" style={linkStyle}
                  onClick={e => { e.preventDefault(); item.onClick(); }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = TEXT}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = TEXT_DIM}
                >{item.label}</a>
              )
            ))}
          </div>
        ))}
      </div>
      <div style={{
        maxWidth: 1100, margin: "40px auto 0", paddingTop: 24,
        borderTop: `1px solid ${BORDER}`, display: "flex",
        justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_DIM }}>
          &copy; 2026 AEGIS PROTOCOL &mdash; ALL RIGHTS RESERVED
        </span>
        <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: TEXT_DIM }}>
          DEPLOYED ON BASE L2
        </span>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body { background: ${BG}; color: ${TEXT}; overflow-x: hidden; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          from { transform: translate(-50%, -50%) scale(1); }
          to { transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.95) rotate(45deg); }
          50% { opacity: 1; transform: scale(1.05) rotate(45deg); }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${BG}; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 3px; }
      `}</style>
      <GeometricBG />
      <NavBar />
      <Hero />
      <Features />
      <GlobeSection />
      <HowItWorks />
      <CodeBlock />
      <LiveFeed />
      <CTA />
      <Footer />
    </>
  );
}
