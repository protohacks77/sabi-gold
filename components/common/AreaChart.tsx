import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  ChartOptions,
  ScriptableContext,
  Chart,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

interface AreaChartProps {
  labels: string[];
  data: number[];
  gradientColors: [string, string];
  lineColor: string;
}

const AreaChart: React.FC<AreaChartProps> = ({ labels, data, gradientColors, lineColor }) => {

  const chartData = {
    labels,
    datasets: [
      {
        data,
        fill: true,
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
          gradient.addColorStop(0, gradientColors[0]);
          gradient.addColorStop(1, gradientColors[1]);
          return gradient;
        },
        borderColor: lineColor,
        pointBackgroundColor: lineColor,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: lineColor,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHitRadius: 20,
      },
    ],
  };

  // Custom plugin to draw the vertical line on hover
  const hoverLinePlugin = {
    id: 'hoverLine',
    afterDraw: (chart: Chart) => {
      if (chart.tooltip?.getActiveElements()?.length) {
        const activeElement = chart.tooltip.getActiveElements()[0];
        const ctx = chart.ctx;
        const x = activeElement.element.x;
        const topY = chart.scales.y.top;
        const bottomY = chart.scales.y.bottom;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, topY);
        ctx.lineTo(x, bottomY);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        displayColors: false,
        backgroundColor: '#1F2937',
        borderColor: '#4B5563',
        borderWidth: 1,
        titleFont: {
            weight: 'bold'
        },
        bodyFont: {
            size: 14
        },
        yAlign: 'bottom',
        callbacks: {
            title: () => '',
            label: (context) => `${context.formattedValue}`
        }
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#9CA3AF',
          font: {
            family: "'Inter', sans-serif",
          },
        },
        border: {
          color: '#4B5563'
        }
      },
      y: {
        grid: {
          color: '#374151',
        },
        ticks: {
          color: '#9CA3AF',
           font: {
            family: "'Inter', sans-serif",
          },
        },
        border: {
          display: false
        }
      },
    },
  };

  return <Line options={options} data={chartData} plugins={[hoverLinePlugin]} />;
};

export default AreaChart;
