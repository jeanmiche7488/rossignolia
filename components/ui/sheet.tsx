import * as React from "react";
import { cn } from "@/lib/utils/cn";

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
}

const SheetContext = React.createContext<SheetContextValue | undefined>(
  undefined
);

const useSheet = () => {
  const context = React.useContext(SheetContext);
  if (!context) {
    throw new Error("Sheet components must be used within Sheet");
  }
  return context;
};

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}

const Sheet = ({
  open = false,
  onOpenChange,
  side = "right",
  children,
}: SheetProps) => {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const isControlled = onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

  React.useEffect(() => {
    if (isControlled) {
      setIsOpen(open);
    }
  }, [open, isControlled, setIsOpen]);

  if (!isOpen) return null;

  const sideClasses = {
    top: "inset-x-0 top-0 border-b",
    right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
    bottom: "inset-x-0 bottom-0 border-t",
    left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
  };

  return (
    <SheetContext.Provider value={{ open: isOpen, onOpenChange: setIsOpen, side }}>
      <div className="fixed inset-0 z-50">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
        <div className={cn("fixed z-50 bg-background", sideClasses[side])}>
          {children}
        </div>
      </div>
    </SheetContext.Provider>
  );
};

const SheetContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { onOpenChange } = useSheet();
  return (
    <div
      ref={ref}
      className={cn("flex h-full flex-col p-6", className)}
      {...props}
    >
      {children}
      <button
        onClick={() => onOpenChange(false)}
        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        ×
      </button>
    </div>
  );
});
SheetContent.displayName = "SheetContent";

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

export { Sheet, SheetContent, SheetHeader, SheetTitle };
