import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { insertFeedingSchema, type InsertFeeding, type Feeding } from "@db/schema";
import { createFeeding, fetchFeedings, updateFeeding, deleteFeeding } from "../lib/api";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreVertical, Edit, Trash, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

type FormValues = Omit<InsertFeeding, "timestamp"> & {
  duration: number[];
};

export default function FeedingLog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const editTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  const { data: feedings = [] } = useQuery({
    queryKey: ['feedings'],
    queryFn: fetchFeedings
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (componentRef.current && !componentRef.current.contains(event.target as Node)) {
        if (editingId !== null) {
          const activeInput = document.querySelector('[data-editing="true"]') as HTMLInputElement;
          if (activeInput) {
            const field = activeInput.dataset.field as keyof Feeding;
            const feeding = feedings.find((f: Feeding) => f.id === editingId);
            if (feeding) {
              const value = field === 'amount' 
                ? activeInput.value ? parseFloat(activeInput.value) : null
                : activeInput.value;
              handleInlineEdit(feeding, field, value);
            }
          }
        }
        setEditingId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingId, feedings]);


  const form = useForm<FormValues>({
    resolver: zodResolver(insertFeedingSchema.omit({ timestamp: true })),
    defaultValues: {
      feedingType: "breast",
      duration: [20],
      amount: undefined,
      notes: ""
    }
  });

  const formatDuration = (minutes: number) => {
    return `${minutes} minutes`;
  };

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const apiData: InsertFeeding = {
        ...data,
        duration: data.duration[0],
        timestamp: new Date(),
      };
      return createFeeding(apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedings'] });
      toast({
        title: "Success",
        description: "Feeding log added successfully",
      });
      setShowForm(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save feeding log",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Feeding> }) => {
      return updateFeeding(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedings'] });
      toast({
        title: "Success",
        description: "Feeding log updated successfully",
      });
      setEditingId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update feeding log",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      return deleteFeeding(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedings'] });
      toast({
        title: "Success",
        description: "Feeding log deleted successfully",
      });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete feeding log",
        variant: "destructive",
      });
    },
  });

  const [savingField, setSavingField] = useState<{ id: number; field: string } | null>(null);
  const [highlightedField, setHighlightedField] = useState<{ id: number; field: string } | null>(null);

  const handleInlineEdit = (feeding: Feeding, field: keyof Feeding, value: any) => {
    setSavingField({ id: feeding.id, field });

    updateMutation.mutate(
      {
        id: feeding.id,
        data: { [field]: value }
      },
      {
        onSuccess: () => {
          toast({
            description: "Changes saved successfully",
            duration: 2000
          });
          setHighlightedField({ id: feeding.id, field });
          setTimeout(() => setHighlightedField(null), 1000);
          setEditingId(null);
          setSavingField(null);
        },
        onError: () => {
          setSavingField(null);
          toast({
            title: "Error",
            description: "Failed to save changes",
            variant: "destructive"
          });
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, feeding: Feeding, field: keyof Feeding) => {
    const target = e.currentTarget;
    
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = field === 'amount' 
        ? target.value ? parseFloat(target.value) : null
        : target.value;
      handleInlineEdit(feeding, field, value);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      target.blur();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const editableFields = ['feedingType', 'duration', 'amount', 'notes'];
      const currentIndex = editableFields.indexOf(field as string);
      const nextField = editableFields[(currentIndex + 1) % editableFields.length];
      
      if (target.value !== feeding[field]?.toString()) {
        const value = field === 'amount' 
          ? target.value ? parseFloat(target.value) : null
          : target.value;
        handleInlineEdit(feeding, field, value);
      }
      
      setEditingId(feeding.id);
      setTimeout(() => {
        const nextInput = document.querySelector(`[data-field="${nextField}"][data-editing="true"]`) as HTMLElement;
        nextInput?.focus();
      }, 0);
    }
  };

  const editableTableCell = (feeding: Feeding, field: keyof Feeding, content: React.ReactNode, isEditing: boolean) => (
    <div 
      className={cn(
        "flex items-center gap-1 transition-colors duration-300",
        highlightedField?.id === feeding.id && highlightedField?.field === field && "bg-primary/10 rounded"
      )}
      tabIndex={isEditing ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isEditing) {
          setEditingId(feeding.id);
        }
      }}
    >
      {savingField?.id === feeding.id && savingField?.field === field ? (
        <div className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {content}
        </div>
      ) : (
        <>
          {content}
          {!isEditing && <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </>
      )}
    </div>
  );

  return (
    <Card className="w-full" ref={componentRef}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Feeding Log</CardTitle>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="h-11 px-6 text-base"
        >
          {showForm ? "Cancel" : "Log feed"}
        </Button>
      </CardHeader>
      <CardContent>
        {showForm ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} 
              className="space-y-6 md:space-y-8">
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="feedingType"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className="text-base">Feeding Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base">
                            <SelectValue placeholder="Select feeding type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="breast" className="h-12 text-base">Breastfeeding</SelectItem>
                          <SelectItem value="bottle" className="h-12 text-base">Bottle</SelectItem>
                          <SelectItem value="solids" className="h-12 text-base">Solids</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className="text-base">
                        Duration: {formatDuration(field.value[0])}
                      </FormLabel>
                      <FormControl>
                        <Slider
                          min={1}
                          max={120}
                          step={1}
                          value={field.value}
                          onValueChange={field.onChange}
                          className="touch-none"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch("feedingType") === "bottle" && (
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel className="text-base">Amount (ounces)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.5" 
                            placeholder="Enter amount (oz)"
                            className="h-12 text-base"
                            {...field} 
                            value={field.value ?? ''} 
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="w-full md:col-span-2">
                      <FormLabel className="text-base">Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          value={field.value ?? ''} 
                          className="min-h-[100px] text-base resize-none"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="w-full md:w-auto h-12 px-8 text-base"
              >
                {createMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </span>
                ) : "Save Feeding"}
              </Button>
            </form>
          </Form>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Amount (ounces)</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedings.map((feeding: Feeding) => (
                    <TableRow key={feeding.id}>
                      <TableCell className="min-h-[44px] py-4">
                        {format(new Date(feeding.timestamp), "PPp")}
                      </TableCell>
                      <TableCell 
                        onClick={() => setEditingId(feeding.id)}
                        className="min-h-[44px] py-4 group cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                        role="button"
                        tabIndex={0}
                        aria-label="Edit feeding type"
                      >
                        {editingId === feeding.id ? (
                          <Select
                            value={feeding.feedingType}
                            onValueChange={(value) => {
                              handleInlineEdit(feeding, "feedingType", value);
                              // Move focus to next field after selection
                              setTimeout(() => {
                                const nextInput = document.querySelector(`[data-field="duration"][data-editing="true"]`) as HTMLElement;
                                nextInput?.focus();
                              }, 0);
                            }}
                            onOpenChange={(open) => {
                              if (!open) {
                                setEditingId(null);
                              }
                            }}
                          >
                            <SelectTrigger 
                              className="h-9"
                              data-field="feedingType"
                              data-editing="true"
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setEditingId(null);
                                } else if (e.key === 'Tab') {
                                  e.preventDefault();
                                  const nextInput = document.querySelector(`[data-field="duration"][data-editing="true"]`) as HTMLElement;
                                  nextInput?.focus();
                                }
                              }}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="breast">Breastfeeding</SelectItem>
                              <SelectItem value="bottle">Bottle</SelectItem>
                              <SelectItem value="solids">Solids</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          editableTableCell(
                            feeding,
                            "feedingType",
                            <span className="capitalize">{feeding.feedingType}</span>,
                            editingId === feeding.id
                          )
                        )}
                      </TableCell>
                      <TableCell 
                        onClick={() => setEditingId(feeding.id)}
                        className="min-h-[44px] py-4 group cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                        role="button"
                        tabIndex={0}
                        aria-label="Edit duration"
                      >
                        {editingId === feeding.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              defaultValue={feeding.duration}
                              className="w-20 h-9"
                              tabIndex={0}
                              data-field="duration"
                              data-editing="true"
                              onBlur={(e) => handleInlineEdit(feeding, "duration", parseInt(e.target.value))}
                              onKeyDown={(e) => handleKeyDown(e, feeding, "duration")}
                            />
                            <span className="text-sm text-muted-foreground">minutes</span>
                          </div>
                        ) : (
                          editableTableCell(
                            feeding,
                            "duration",
                            formatDuration(feeding.duration),
                            editingId === feeding.id
                          )
                        )}
                      </TableCell>
                      <TableCell 
                        onClick={() => feeding.feedingType === "bottle" && setEditingId(feeding.id)}
                        className={cn(
                          "min-h-[44px] py-4 group transition-colors",
                          feeding.feedingType === "bottle" && "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        )}
                        role={feeding.feedingType === "bottle" ? "button" : undefined}
                        tabIndex={feeding.feedingType === "bottle" ? 0 : undefined}
                        aria-label={feeding.feedingType === "bottle" ? "Edit amount" : undefined}
                      >
                        {feeding.feedingType === "bottle" && (
                          editingId === feeding.id ? (
                            <Input
                              type="number"
                              step="0.5"
                              defaultValue={feeding.amount ?? ''}
                              className="w-20 h-9"
                              tabIndex={0}
                              data-field="amount"
                              data-editing="true"
                              onBlur={(e) => handleInlineEdit(feeding, "amount", e.target.value ? parseFloat(e.target.value) : null)}
                              onKeyDown={(e) => handleKeyDown(e, feeding, "amount")}
                            />
                          ) : (
                            editableTableCell(
                              feeding,
                              "amount",
                              <span>{feeding.amount ? `${feeding.amount} ounces` : "-"}</span>,
                              editingId === feeding.id
                            )
                          )
                        )}
                      </TableCell>
                      <TableCell 
                        onClick={() => setEditingId(feeding.id)}
                        className="min-h-[44px] py-4 group cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                        role="button"
                        tabIndex={0}
                        aria-label="Edit notes"
                      >
                        {editingId === feeding.id ? (
                          <Input
                            defaultValue={feeding.notes ?? ''}
                            className="h-9"
                            tabIndex={0}
                            data-field="notes"
                            data-editing="true"
                            onBlur={(e) => handleInlineEdit(feeding, "notes", e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, feeding, "notes")}
                          />
                        ) : (
                          editableTableCell(
                            feeding,
                            "notes",
                            <span className="max-w-xs truncate">{feeding.notes}</span>,
                            editingId === feeding.id
                          )
                        )}
                      </TableCell>
                      <TableCell className="min-h-[44px] py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setEditingId(editingId === feeding.id ? null : feeding.id)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              {editingId === feeding.id ? "Done" : "Edit"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteConfirmId(feeding.id)}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden space-y-4">
              {feedings.map((feeding: Feeding) => (
                <Card key={feeding.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{format(new Date(feeding.timestamp), "PPp")}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditingId(editingId === feeding.id ? null : feeding.id)}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          {editingId === feeding.id ? "Done" : "Edit"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConfirmId(feeding.id)}
                        >
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="space-y-2">
                    <div 
                      className="flex justify-between items-center group cursor-pointer hover:bg-accent hover:text-accent-foreground rounded p-2 transition-colors"
                      onClick={() => setEditingId(feeding.id)}
                      role="button"
                      tabIndex={0}
                      aria-label="Edit feeding type"
                    >
                      <span className="text-sm text-muted-foreground">Type</span>
                      {editingId === feeding.id ? (
                        <Select
                          value={feeding.feedingType}
                          onValueChange={(value) => handleInlineEdit(feeding, "feedingType", value)}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="breast">Breastfeeding</SelectItem>
                            <SelectItem value="bottle">Bottle</SelectItem>
                            <SelectItem value="solids">Solids</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        editableTableCell(
                          feeding,
                          "feedingType",
                          <span className="capitalize">{feeding.feedingType}</span>,
                          editingId === feeding.id
                        )
                      )}
                    </div>

                    <div 
                      className="flex justify-between items-center group cursor-pointer hover:bg-accent hover:text-accent-foreground rounded p-2 transition-colors"
                      onClick={() => setEditingId(feeding.id)}
                      role="button"
                      tabIndex={0}
                      aria-label="Edit duration"
                    >
                      <span className="text-sm text-muted-foreground">Duration</span>
                      {editingId === feeding.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            defaultValue={feeding.duration}
                            className="w-20 h-8"
                            tabIndex={0}
                            data-field="duration"
                            data-editing="true"
                            onBlur={(e) => handleInlineEdit(feeding, "duration", parseInt(e.target.value))}
                            onKeyDown={(e) => handleKeyDown(e, feeding, "duration")}
                          />
                          <span className="text-sm text-muted-foreground">minutes</span>
                        </div>
                      ) : (
                        editableTableCell(
                          feeding,
                          "duration",
                          formatDuration(feeding.duration),
                          editingId === feeding.id
                        )
                      )}
                    </div>

                    {feeding.feedingType === "bottle" && (
                      <div 
                        className="flex justify-between items-center group cursor-pointer hover:bg-accent hover:text-accent-foreground rounded p-2 transition-colors"
                        onClick={() => setEditingId(feeding.id)}
                        role="button"
                        tabIndex={0}
                        aria-label="Edit amount"
                      >
                        <span className="text-sm text-muted-foreground">Amount</span>
                        {editingId === feeding.id ? (
                          <Input
                            type="number"
                            step="0.5"
                            defaultValue={feeding.amount ?? ''}
                            className="w-20 h-8"
                            tabIndex={0}
                            data-field="amount"
                            data-editing="true"
                            onBlur={(e) => handleInlineEdit(feeding, "amount", e.target.value ? parseFloat(e.target.value) : null)}
                            onKeyDown={(e) => handleKeyDown(e, feeding, "amount")}
                          />
                        ) : (
                          editableTableCell(
                            feeding,
                            "amount",
                            <span>{feeding.amount ? `${feeding.amount} ounces` : "-"}</span>,
                            editingId === feeding.id
                          )
                        )}
                      </div>
                    )}

                    <div 
                      className="group cursor-pointer hover:bg-accent hover:text-accent-foreground rounded p-2 transition-colors"
                      onClick={() => setEditingId(feeding.id)}
                      role="button"
                      tabIndex={0}
                      aria-label="Edit notes"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-muted-foreground">Notes</span>
                        {!editingId && <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                      {editingId === feeding.id ? (
                        <Input
                          defaultValue={feeding.notes ?? ''}
                          className="h-8 mt-2"
                          tabIndex={0}
                          data-field="notes"
                          data-editing="true"
                          onBlur={(e) => handleInlineEdit(feeding, "notes", e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, feeding, "notes")}
                        />
                      ) : (
                        <p className="text-sm">{feeding.notes || "-"}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Feeding Log</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this feeding log? This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirmId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}