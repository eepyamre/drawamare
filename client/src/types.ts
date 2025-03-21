export type Stroke = {
  id: string;
  points: number[];
  stroke: string;
  thickness: number;
};

export type StrokeEvent = {
  userId: string;
  stroke: Stroke;
};
