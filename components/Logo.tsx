import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <img src="/logo.png" alt="ProHappyAssignments Logo" className={className} />
);

export default Logo;