declare module 'react-native-svg-charts' {
  import { Component } from 'react';
  
  interface LineChartProps {
    style?: any;
    data: number[];
    svg?: {
      stroke?: string;
      strokeWidth?: number;
      fill?: string;
    };
    contentInset?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
    animate?: boolean;
    animationDuration?: number;
    gridMin?: number;
    gridMax?: number;
    numberOfTicks?: number;
    formatXLabel?: (value: any, index: number) => string;
    formatYLabel?: (value: any) => string;
    decorator?: (props: any) => React.ReactElement;
    showGrid?: boolean;
    showXAxis?: boolean;
    showYAxis?: boolean;
  }
  
  export class LineChart extends Component<LineChartProps> {}
}
