export type CompareSlot = 'a' | 'b';

export interface MeasuredRow {
  id: string;
  label: string;
  value: string;
  swatch?: string;
}

export interface WaveformColumn { min: number; max: number }
