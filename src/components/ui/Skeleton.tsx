import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => {
  return (
    <div
      className={`animate-shimmer rounded-2xl bg-rose-200/50 ${className}`}
      {...props}
    />
  );
};

export const FoodCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-3xl p-4 border border-rose-100 shadow-xs flex flex-col justify-between space-y-3">
    <Skeleton className="w-full h-44 rounded-2xl" />
    <div className="space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <div className="flex items-center justify-between pt-2">
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-9 w-9 rounded-full" />
    </div>
  </div>
);

export const CategorySkeleton: React.FC = () => (
  <div className="flex flex-col items-center space-y-2 p-2">
    <Skeleton className="w-16 h-16 rounded-2xl" />
    <Skeleton className="h-3 w-12" />
  </div>
);

export const VendorCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-3xl p-4 border border-rose-100 shadow-xs space-y-3">
    <Skeleton className="w-full h-32 rounded-2xl" />
    <div className="flex items-center space-x-3">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="space-y-1.5 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  </div>
);

export const ChatMessageSkeleton: React.FC = () => (
  <div className="space-y-3 p-2">
    <div className="flex items-start gap-2.5 max-w-[75%]">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <Skeleton className="h-12 w-48 rounded-2xl" />
    </div>
    <div className="flex items-start gap-2.5 max-w-[75%] ml-auto flex-row-reverse">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <Skeleton className="h-10 w-36 rounded-2xl" />
    </div>
  </div>
);

export const OrderCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-3xl p-5 border border-rose-100 shadow-xs space-y-3">
    <div className="flex justify-between items-center">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
    <Skeleton className="h-12 w-full rounded-2xl" />
    <div className="flex justify-between items-center pt-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-28 rounded-xl" />
    </div>
  </div>
);
