declare module 'react-native-echarts-wrapper' {
  import { Component } from 'react';
  
  interface EChartsProps {
    option: any;
    height?: number;
    width?: number;
    backgroundColor?: string;
    onPress?: (params: any) => void;
  }
  
  export class ECharts extends Component<EChartsProps> {}
}
