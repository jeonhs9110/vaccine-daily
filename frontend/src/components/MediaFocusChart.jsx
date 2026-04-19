import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';

const CustomBarLabel = (props) => {
    const { x, y, width, height, value, index } = props;
    const item = props.data[index];
    return (
        <text
            x={x + width + 6}
            y={y + height / 2}
            dominantBaseline="central"
            fontSize={14}
            fill="#333"
        >
            <tspan fontWeight="600" fill="#3B82F6" fontSize={15}>{value}%</tspan>
            <tspan fill="#888" dx="6" fontSize={13}>({item.issue_count}/{item.total_count}건)</tspan>
        </text>
    );
};

const MediaFocusChart = ({ data }) => {
    // 데이터가 없으면 컴포넌트를 렌더링하지 않음
    if (!data || !data.media_focus || data.media_focus.length === 0) {
        return null;
    }

    const { media_focus } = data;
    const chartData = media_focus.slice(0, 5);

    return (
        <div className="media-focus-chart-container" style={{ width: '100%', height: '100%', padding: '0' }}>
            <h3 className="section-title" style={{ textAlign: 'left', marginTop: '0' }}>
                이 이슈를 가장 많이 다룬 언론사
            </h3>

            <ResponsiveContainer width="100%" height={250}>
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 120, left: 40, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                    <XAxis type="number" domain={[0, 'auto']} hide />
                    <YAxis
                        type="category"
                        dataKey="company"
                        width={60}
                        tick={{ fontSize: 13, fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Bar dataKey="focus_pct" radius={[0, 4, 4, 0]} barSize={24} fill="#3B82F6" isAnimationActive={false}>
                        <LabelList
                            dataKey="focus_pct"
                            content={<CustomBarLabel data={chartData} />}
                        />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MediaFocusChart;
