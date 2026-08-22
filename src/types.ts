export interface PrayerText {
  id: string;
  title: string;
  text: string;
  updatedBy: string;
  updatedAt: string;
}

export type BeadColorType = 'white' | 'black' | 'red' | 'green' | 'blue' | 'cyan' | 'magenta' | 'yellow' | 'transparent';

export interface BeadData {
  id: string;
  index: number;
  type: 'cross' | 'intro-father' | 'intro-virtue' | 'intro-glory' | 'connector' | 'decade-bead' | 'decade-separator';
  colorType: BeadColorType;
  decadeIndex?: number; // 0 to 4
}

export interface RosaryConfig {
  id: 'rgba' | 'cmyk';
  name: string;
  crossColor: string;
  connectorType: 'silver' | 'gold';
  beads: BeadData[];
}

export interface PrayerStep {
  id: string;
  label: string; // e.g. "Krzyż - Wierzę w Boga", "Dziesiątek 1, Paciorek 3"
  beadIndex: number; // Index in the bead list (0 to 59 or similar)
  prayerType: 'creed' | 'ourFather' | 'hailMary' | 'gloryBe' | 'fatima' | 'hailQueen' | 'signOfCross' | 'mystery';
  rgbaBeadId: string;
  cmykBeadId: string;
  decadeIndex?: number; // 1 to 5
  beadNumber?: number; // 1 to 10 for Hail Marys
  text?: string;
}
