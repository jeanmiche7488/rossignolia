'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';

interface AlertDialogProps {
  children: React.ReactNode;
}

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | undefined>(undefined);

const useAlertDialog = () => {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error('AlertDialog components must be used within AlertDialog');
  }
  return context;
};

const AlertDialog = ({ children }: AlertDialogProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
};

const AlertDialogTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ asChild, children, ...props }, ref) => {
  const { setOpen } = useAlertDialog();

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      ...props,
      onClick: () => setOpen(true),
    } as any);
  }

  return (
    <button ref={ref} onClick={() => setOpen(true)} {...props}>
      {children}
    </button>
  );
});
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

const AlertDialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useAlertDialog();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent ref={ref} className={className} {...props}>
        {children}
      </DialogContent>
    </Dialog>
  );
});
AlertDialogContent.displayName = 'AlertDialogContent';

const AlertDialogHeader = DialogHeader;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;

const AlertDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className || ''}`}
    {...props}
  >
    {children}
  </div>
));
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <Button ref={ref} className={className} {...props}>
    {children}
  </Button>
));
AlertDialogAction.displayName = 'AlertDialogAction';

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { setOpen } = useAlertDialog();
  return (
    <Button
      ref={ref}
      variant="outline"
      onClick={() => setOpen(false)}
      className={className}
      {...props}
    >
      {children}
    </Button>
  );
});
AlertDialogCancel.displayName = 'AlertDialogCancel';

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
};
