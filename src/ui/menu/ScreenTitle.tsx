import { MenuBadge, type MenuBadgeKind } from './MenuBadge';

/** A menu screen's heading: the same hex badge as its home button, a title and a line under it. */
export function ScreenTitle({
  badge,
  title,
  subtitle,
  as: Heading = 'h1',
}: {
  badge: MenuBadgeKind;
  title: string;
  subtitle?: string;
  as?: 'h1' | 'h2';
}) {
  return (
    <div className="screen-title">
      <span className="screen-title-badge">
        <MenuBadge kind={badge} />
      </span>
      <span className="screen-title-text">
        <Heading className="screen-title-heading">{title}</Heading>
        {subtitle && <span className="screen-title-sub">{subtitle}</span>}
      </span>
    </div>
  );
}
