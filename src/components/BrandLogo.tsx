type BrandLogoProps = {
  compact?: boolean;
  subtitle?: string;
};

export default function BrandLogo({
  compact = false,
  subtitle
}: BrandLogoProps) {
  return (
    <div className={compact ? 'of-brand compact' : 'of-brand'}>
      <span className="of-monogram" aria-hidden="true">
        <span className="of-letter-o">O</span>
        <span className="of-letter-f">F</span>
      </span>

      <span className="of-brand-copy">
        <strong>OjaFlow</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </div>
  );
}