export interface IDomEventsController {
  _onKeyDown: (e: KeyboardEvent) => void;
  _onKeyUp: (e: KeyboardEvent) => void;
  _initEvents: () => void;
}
