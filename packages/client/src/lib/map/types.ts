export interface MapTile {
  id: number;
  q: number;
  r: number;
  color: string;
  decor: number;
}

export interface MapInsets {
  top: number;
  bottom: number;
  right?: number;
}

export interface HexMapApi {
  setTiles(tiles: MapTile[], captureOrder?: number[]): void;
  setInsets(insets: MapInsets): void;
  setInteractive(on: boolean): void;
  resize(): void;
  destroy(): void;
}
