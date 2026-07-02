export interface AddDeviceButtonProps {
  label?: string;
  onPress?: () => void;
}

export function AddDeviceButton({
  label = "+ Add Device",
  onPress
}: AddDeviceButtonProps) {
  return (
    <button className="add-device-button" type="button" onClick={onPress}>
      {label}
    </button>
  );
}
