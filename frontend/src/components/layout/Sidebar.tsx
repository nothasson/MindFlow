export function Sidebar() {
  return (
    <div className="sticky top-6 space-y-4">
      <section className="rounded-3xl border border-amber-100 bg-white/80 p-6 shadow-[0_10px_40px_rgba(245,158,11,0.08)] backdrop-blur">
        <p className="text-xs font-semibold tracking-wide text-amber-600">MindFlow 导师台</p>
        <h2 className="mt-3 text-2xl font-semibold leading-snug text-slate-900">
          温和引导，
          <br />
          持续成长
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          这里会逐步承载学习目标、复习提醒、知识图谱等信息，帮助你形成连续学习节奏。
        </p>
      </section>

      <section className="rounded-3xl border border-rose-100 bg-rose-50/70 p-5">
        <h3 className="text-sm font-semibold text-rose-700">今日学习建议</h3>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-rose-900/80">
          <li>· 先说出你当前的理解，再提问</li>
          <li>· 每轮只推进一个关键概念</li>
          <li>· 错题会自动转入后续复习</li>
        </ul>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/70 p-5">
        <h3 className="text-sm font-semibold text-slate-700">苏格拉底原则</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          导师不会直接给答案，会通过追问和提示，帮你一步步建立自己的推理路径。
        </p>
      </section>
    </div>
  );
}
