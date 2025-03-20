import css from './styles.module.scss';

interface LayerProps {
  layers: { id: string; name: string }[];
  activeLayerId: string | null;
  onLayerSelect: (id: string) => void;
  onAddLayer: () => void;
}
export const LayerMenu = ({
  layers,
  activeLayerId,
  onLayerSelect,
  onAddLayer,
}: LayerProps) => {
  return (
    <div class={css.layerMenu}>
      <h3>Layers</h3>
      <ul>
        {layers.map((layer) => (
          <li
            key={layer.id}
            class={layer.id === activeLayerId ? css.active : ''}
            onClick={() => onLayerSelect(layer.id)}
          >
            {layer.name}
          </li>
        ))}
      </ul>
      <button onClick={onAddLayer}>Add Layer</button>
    </div>
  );
};
