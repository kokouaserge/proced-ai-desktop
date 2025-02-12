export const Logo = ({
  className,
}: {
  className: string;
  showVersion?: boolean;
  showBeta?: boolean;
  white?: boolean;
}) => {
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <img
        src="https://app.proced.ai/images/logo/logo.svg"
        alt="logo"
        className="w-auto h-auto"
      />
    </div>
  );
};
