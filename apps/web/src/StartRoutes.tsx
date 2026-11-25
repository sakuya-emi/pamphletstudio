export function StartRoutes({
  onTemplates,
  onBook,
}: {
  onTemplates: () => void;
  onBook: () => void;
}) {
  return (
    <main className="start-routes" aria-label="制作の入口">
      <h1>何を作りますか？</h1>
      <div className="start-route-grid">
        <button onClick={onTemplates}>
          <svg viewBox="0 0 220 112" aria-hidden="true">
            <path d="M35 15H185V97H35Z" fill="#25272a" stroke="#999" />
            <path d="M71 24H153V89H71Z" fill="#f3f3f2" />
            <path
              d="M84 41H135M84 48H135M84 55H135M84 62H135M84 69H135M103 41V69"
              stroke="#52545a"
            />
            <path
              d="M81 38H139V72H81Z"
              fill="none"
              stroke="#222"
              strokeDasharray="3 2"
            />
            <path
              d="M43 28H60M43 37H55M43 46H59M160 29H177M160 38H177M160 47H173"
              stroke="#bbb"
            />
          </svg>
          <strong>テンプレートを作る</strong>
          <span>
            表、見出し、インデックスなどの共通デザインを制作します。作成したデザインは、今後のパンフレットでも利用できます。
          </span>
        </button>
        <button onClick={onBook}>
          <svg viewBox="0 0 220 112" aria-hidden="true">
            <path d="M35 15H109V97H35ZM111 15H185V97H111Z" fill="#f3f3f2" />
            <path
              d="M45 28H92M45 38H83M45 71H96M45 77H89M45 83H93"
              stroke="#51545a"
              strokeWidth="3"
            />
            <path
              d="M45 46H98V65H45ZM122 26H147V56H122ZM151 26H175V56H151ZM122 60H147V87H122ZM151 60H175V87H151Z"
              fill="#8d8e92"
            />
          </svg>
          <strong>パンフレットを作る</strong>
          <span>
            デザインを選択し、Excelの情報や画像を登録してパンフレットを完成させます。
          </span>
        </button>
      </div>
    </main>
  );
}
