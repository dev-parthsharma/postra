interface SpinnerProps {
  size?: number;
}

export const Spinner = ({ size = 20 }: SpinnerProps) => {
  return (
    <div className="flex items-center justify-center">
      <div
        style={{ width: size, height: size }}
        className="border-2 border-current border-t-transparent rounded-full animate-spin"
      />
    </div>
  );
};