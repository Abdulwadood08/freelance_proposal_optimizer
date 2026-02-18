"use client";

import styles from "./QualityRadarChart.module.css";

interface QualityData {
  originality: number;
  personalization: number;
  valueProposition: number;
  professionalTone: number;
  callToAction: number;
  empathy: number;
  formatting: number;
}

interface QualityRadarChartProps {
  data: QualityData;
}

export default function QualityRadarChart({ data }: QualityRadarChartProps) {
  const size = 200;
  const center = size / 2;
  const radius = 80;
  const axes = [
    { label: "Originality", value: data.originality, angle: -Math.PI / 2 },
    { label: "Personalization", value: data.personalization, angle: -Math.PI / 2 + (2 * Math.PI) / 7 },
    { label: "Value Proposition", value: data.valueProposition, angle: -Math.PI / 2 + (4 * Math.PI) / 7 },
    { label: "Professional Tone", value: data.professionalTone, angle: -Math.PI / 2 + (6 * Math.PI) / 7 },
    { label: "Clear Call-to-Action", value: data.callToAction, angle: -Math.PI / 2 + (8 * Math.PI) / 7 },
    { label: "Empathy", value: data.empathy, angle: -Math.PI / 2 + (10 * Math.PI) / 7 },
    { label: "Formatting", value: data.formatting, angle: -Math.PI / 2 + (12 * Math.PI) / 7 },
  ];

  const getPoint = (angle: number, value: number) => {
    const r = (radius * value) / 100;
    const x = center + r * Math.sin(angle);
    const y = center - r * Math.cos(angle);
    return { x, y };
  };

  const points = axes.map((axis) => getPoint(axis.angle, axis.value));
  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ") + " Z";

  return (
    <div className={styles.container}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.chart}>
        {/* Grid circles */}
        {[25, 50, 75, 100].map((level) => (
          <circle
            key={level}
            cx={center}
            cy={center}
            r={(radius * level) / 100}
            className={styles.gridCircle}
          />
        ))}
        
        {/* Grid lines (axes) */}
        {axes.map((axis, i) => {
          const end = getPoint(axis.angle, 100);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              className={styles.gridLine}
            />
          );
        })}

        {/* Data polygon */}
        <path d={pathData} className={styles.dataPolygon} />

        {/* Axis labels */}
        {axes.map((axis, i) => {
          const labelPos = getPoint(axis.angle, 110);
          return (
            <text
              key={i}
              x={labelPos.x}
              y={labelPos.y}
              className={styles.label}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
