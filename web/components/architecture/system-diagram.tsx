/**
 * Static system diagram as inline SVG (no runtime diagram library). Colours come from the
 * design tokens, so it follows light/dark mode. On narrow screens the page shows a stacked
 * text version instead (see SystemStack).
 */

type BoxProps = { x: number; y: number; w: number; h: number; title: string; lines?: string[]; accent?: boolean; dashed?: boolean };

function Box({ x, y, w, h, title, lines = [], accent, dashed }: BoxProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill={accent ? "var(--primary-soft)" : "var(--surface)"}
        stroke={accent ? "var(--primary)" : "var(--border-strong)"}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "6 4" : undefined}
      />
      <text x={x + 16} y={y + 28} fontSize={15} fontWeight={600} fill="var(--foreground)">
        {title}
      </text>
      {lines.map((line, i) => (
        <text key={line} x={x + 16} y={y + 52 + i * 19} fontSize={12.5} fill="var(--muted)">
          {line}
        </text>
      ))}
    </g>
  );
}

function Arrow({ d, label, lx, ly, dashed, anchor = "middle" }: { d: string; label?: string; lx?: number; ly?: number; dashed?: boolean; anchor?: "start" | "middle" | "end" }) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="var(--muted)"
        strokeWidth={1.5}
        strokeDasharray={dashed ? "5 4" : undefined}
        markerEnd="url(#arrow)"
      />
      {label && lx !== undefined && ly !== undefined && (
        <text x={lx} y={ly} fontSize={11.5} textAnchor={anchor} fill="var(--muted)" paintOrder="stroke" stroke="var(--background)" strokeWidth={4}>
          {label}
        </text>
      )}
    </g>
  );
}

const MONO = { fontFamily: "var(--font-mono), ui-monospace, monospace" };
const PILL_CHAR = 7; // approx. advance of 11px monospace

/** One row of LangGraph node names, laid out left to right. */
function PillRow({ x, y, labels }: { x: number; y: number; labels: string[] }) {
  const widths = labels.map((label) => label.length * PILL_CHAR + 16);
  const lefts = widths.map((_, i) => x + widths.slice(0, i).reduce((sum, w) => sum + w + 6, 0));
  return (
    <g>
      {labels.map((label, i) => (
        <g key={label}>
          <rect x={lefts[i]} y={y} width={widths[i]} height={22} rx={11} fill="var(--surface)" stroke="var(--primary)" strokeWidth={1} />
          <text x={lefts[i] + widths[i] / 2} y={y + 15} fontSize={11} textAnchor="middle" fill="var(--primary-text)" style={MONO}>
            {label}
          </text>
        </g>
      ))}
    </g>
  );
}

export function SystemDiagram() {
  return (
    <svg viewBox="0 0 1000 560" role="img" aria-labelledby="diagram-title diagram-desc" className="h-auto w-full">
      <title id="diagram-title">OrderPilot system architecture</title>
      <desc id="diagram-desc">
        The Next.js PWA calls the FastAPI AI service and the Spring Boot core API with an Entra ID token. The AI
        service runs a LangGraph agent that uses Claude or Azure OpenAI and Azure AI Search, and calls the core API as
        tools on behalf of the user. The core API stores data in Azure SQL.
      </desc>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--muted)" />
        </marker>
      </defs>

      {/* Column labels */}
      {[
        [20, "CLIENT"],
        [330, "SERVICES"],
        [760, "AZURE PLATFORM"],
      ].map(([x, label]) => (
        <text key={label} x={x as number} y={18} fontSize={11} fontWeight={600} letterSpacing={1.2} fill="var(--muted)">
          {label}
        </text>
      ))}

      {/* Client */}
      <Box x={20} y={36} w={210} h={64} title="Sales rep · Manager" lines={["Phone or laptop"]} />
      <Box x={20} y={150} w={210} h={168} accent title="Next.js PWA" lines={["App Router · TypeScript", "TanStack Query · Tailwind", "Service worker (offline)", "MSAL (Entra ID)", "Vercel / Container Apps"]} />
      <Box x={20} y={420} w={210} h={96} title="Microsoft Entra ID" lines={["App registrations", "App roles: REP · MANAGER"]} />

      {/* Services */}
      <Box x={330} y={36} w={330} h={232} accent title="AI service · FastAPI" lines={["Python 3.12 · LangGraph agent", "Human-in-the-loop: never orders itself"]} />
      <PillRow x={346} y={122} labels={["classify_intent", "extract_order"]} />
      <PillRow x={346} y={152} labels={["resolve_entities", "quote", "propose"]} />
      <PillRow x={346} y={182} labels={["retrieve", "answer_with_citations"]} />
      <text x={346} y={234} fontSize={11.5} fill="var(--muted)">
        chat · chat/confirm · knowledge/search · prompt-studio
      </text>

      <Box x={330} y={330} w={330} h={186} accent title="Core API · Spring Boot" lines={["Java 21 · Spring Data JPA · Flyway", "Spring Security (JWT resource server)", "Pricing · promotions · credit · stock", "Idempotent order creation", "Spring AI order summaries"]} />

      {/* Azure platform */}
      <Box x={760} y={36} w={220} h={84} title="Claude / Azure OpenAI" lines={["via Azure AI Foundry", "mock provider for tests"]} />
      <Box x={760} y={150} w={220} h={84} title="Azure AI Search" lines={["Policy documents (RAG)", "local BM25 fallback"]} />
      <Box x={760} y={330} w={220} h={84} title="Azure SQL" lines={["Outlets · products · orders", "H2 / Postgres locally"]} />
      <Box x={760} y={432} w={220} h={84} dashed title="Key Vault · App Insights" lines={["Secrets (managed identity)", "Logs with X-Request-Id"]} />

      {/* Flows */}
      <Arrow d="M125 100 V146" />
      <Arrow d="M230 200 H326" label="/ai/*" lx={278} ly={192} />
      <Arrow d="M230 292 C 285 292, 285 400, 326 400" label="/api/*" lx={290} ly={340} anchor="start" />
      <Arrow d="M125 318 V416" label="MSAL sign-in" lx={133} ly={372} anchor="start" />
      <Arrow d="M495 268 V326" label="tools, on behalf of the user" lx={503} ly={302} anchor="start" />
      <Arrow d="M660 78 H756" />
      <Arrow d="M660 192 H756" />
      <Arrow d="M660 372 H756" />
      <Arrow d="M660 480 C 712 480, 712 112, 756 104" dashed />
      <Arrow d="M230 468 C 282 468, 282 500, 326 500" dashed label="validate JWT" lx={236} ly={540} anchor="start" />
    </svg>
  );
}

/** Narrow-screen equivalent of the diagram: the same components as a stacked list. */
export function SystemStack() {
  const tiers = [
    { name: "Next.js PWA", detail: "TypeScript, TanStack Query, service worker, MSAL", accent: true },
    { name: "AI service: FastAPI + LangGraph", detail: "classify → extract → resolve → quote → propose; RAG for policy questions", accent: true },
    { name: "Core API: Spring Boot (Java 21)", detail: "JPA, Flyway, pricing, credit, idempotent orders, Spring AI summaries", accent: true },
    { name: "Azure platform", detail: "Claude / Azure OpenAI, Azure AI Search, Azure SQL, Key Vault, Entra ID" },
  ];
  return (
    <ol className="flex flex-col items-stretch gap-2">
      {tiers.map((t, i) => (
        <li key={t.name} className="flex flex-col items-center gap-2">
          <div
            className={`w-full rounded-xl border p-3 text-sm ${t.accent ? "border-primary bg-primary-soft" : "border-border-strong bg-surface"}`}
          >
            <p className="font-semibold">{t.name}</p>
            <p className="mt-0.5 text-muted">{t.detail}</p>
          </div>
          {i < tiers.length - 1 && (
            <span aria-hidden className="text-muted">
              ↓
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
