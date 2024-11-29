import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { insertSleepSchema, type InsertSleep, type Sleep } from "@db/schema";
import { createSleepLog, fetchSleepLogs, updateSleepLog, deleteSleepLog } from "../lib/api";
import { format, differenceInMinutes, addHours, addMinutes, formatDistanceToNow } from "date-fns";
import { CalendarIcon, MoreVertical, Edit, Trash, Moon, Sun, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FormValues = {
  date: Date;
  startTime: string;
  endTime: string;
  sleepType: "nap" | "night";
  notes: string;
};

type PresetDuration = {
  label: string;
  hours: number;
  minutes: number;
  tooltip?: string;
};

const napPresets: PresetDuration[] = [
  { label: "30min", hours: 0, minutes: 30, tooltip: "Quick power nap" },
  { label: "1h", hours: 1, minutes: 0, tooltip: "Standard nap duration" },
  { label: "1.5h", hours: 1, minutes: 30, tooltip: "Full sleep cycle" },
  { label: "2h", hours: 2, minutes: 0, tooltip: "Long nap" },
];

const nightPresets: PresetDuration[] = [
  { label: "8h", hours: 8, minutes: 0, tooltip: "Minimum recommended sleep" },
  { label: "10h", hours: 10, minutes: 0, tooltip: "Optimal sleep duration" },
  { label: "12h", hours: 12, minutes: 0, tooltip: "Maximum recommended sleep" },
];

const recommendedDurations = {
  nap: { min: 20, max: 180 }, // 20min to 3h
  night: { min: 420, max: 780 }, // 7h to 13h
};

export default function SleepLog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const editTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (componentRef.current && !componentRef.current.contains(event.target as Node)) {
        if (editTimeoutRef.current) {
          clearTimeout(editTimeoutRef.current);
          editTimeoutRef.current = null;
        }
        setEditingId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const { data: sleepLogs = [] } = useQuery({
    queryKey: ['sleep'],
    queryFn: fetchSleepLogs
  });

  const form = useForm<FormValues>({
    defaultValues: {
      date: new Date(),
      startTime: format(new Date(), "HH:mm"),
      endTime: format(addHours(new Date(), 8), "HH:mm"),
      sleepType: "night",
      notes: ""
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const startDateTime = new Date(data.date);
      const [startHours, startMinutes] = data.startTime.split(":").map(Number);
      startDateTime.setHours(startHours, startMinutes);
      
      const endDateTime = new Date(data.date);
      const [endHours, endMinutes] = data.endTime.split(":").map(Number);
      endDateTime.setHours(endHours, endMinutes);
      
      // If end time is before start time, assume it's the next day
      if (endDateTime < startDateTime) {
        endDateTime.setDate(endDateTime.getDate() + 1);
      }

      const apiData: InsertSleep = {
        startTime: startDateTime,
        endTime: endDateTime,
        sleepType: data.sleepType,
        notes: data.notes
      };

      return createSleepLog(apiData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
      toast({
        title: "Success",
        description: "Sleep log added successfully",
      });
      setShowForm(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save sleep log",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Sleep> }) => {
      return updateSleepLog(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
      toast({
        title: "Success",
        description: "Sleep log updated successfully",
      });
      setEditingId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sleep log",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => {
      return deleteSleepLog(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
      toast({
        title: "Success",
        description: "Sleep log deleted successfully",
      });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete sleep log",
        variant: "destructive",
      });
    },
  });

  const [savingField, setSavingField] = useState<{ id: number; field: string } | null>(null);
  const [highlightedField, setHighlightedField] = useState<{ id: number; field: string } | null>(null);

  const handleInlineEdit = (sleep: Sleep, field: keyof Sleep, value: any) => {
    if (editTimeoutRef.current) {
      clearTimeout(editTimeoutRef.current);
    }

    setSavingField({ id: sleep.id, field });

    editTimeoutRef.current = setTimeout(() => {
      updateMutation.mutate(
        {
          id: sleep.id,
          data: { [field]: value }
        },
        {
          onSuccess: () => {
            toast({
              description: "Changes saved successfully",
              duration: 2000
            });
            setHighlightedField({ id: sleep.id, field });
            setTimeout(() => setHighlightedField(null), 1000);
          }
        }
      );
      setEditingId(null);
      setSavingField(null);
      editTimeoutRef.current = null;
    }, 500);
  };

  const calculateDuration = () => {
    const startDateTime = new Date();
    const [startHours, startMinutes] = form.watch("startTime").split(":").map(Number);
    startDateTime.setHours(startHours, startMinutes);

    const endDateTime = new Date();
    const [endHours, endMinutes] = form.watch("endTime").split(":").map(Number);
    endDateTime.setHours(endHours, endMinutes);

    if (endDateTime < startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }

    const minutes = differenceInMinutes(endDateTime, startDateTime);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    // Check if duration is within recommended range
    const sleepType = form.watch("sleepType");
    const { min, max } = recommendedDurations[sleepType];
    const durationClass = minutes < min ? "text-yellow-500" :
                         minutes > max ? "text-red-500" :
                         "text-green-500";

    return {
      text: `${hours}h ${remainingMinutes}m`,
      class: durationClass
    };
  };

  const applyPreset = (preset: PresetDuration) => {
    const startTime = form.watch("startTime");
    const [hours, minutes] = startTime.split(":").map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes);
    
    const endDate = addMinutes(addHours(startDate, preset.hours), preset.minutes);
    form.setValue("endTime", format(endDate, "HH:mm"));
  };

  const getRecommendedEndTimes = () => {
    const startTime = form.watch("startTime");
    const [hours, minutes] = startTime.split(":").map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes);
    
    return napPresets.map(preset => {
      const endTime = addMinutes(addHours(startDate, preset.hours), preset.minutes);
      return format(endTime, "HH:mm");
    });
  };

  const getTimeSinceLastNap = () => {
    const lastNap = sleepLogs.find((log: Sleep) => log.sleepType === "nap");
    if (!lastNap) return null;
    return formatDistanceToNow(new Date(lastNap.endTime), { addSuffix: true });
  };

  return (
    <Card className="w-full" ref={componentRef}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Sleep Log</CardTitle>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="h-11 px-6 text-base"
        >
          {showForm ? "Cancel" : "Add Sleep"}
        </Button>
      </CardHeader>
      <CardContent>
        {showForm ? (
          <Form {...form}>
            <form 
              onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} 
              className="space-y-6 md:space-y-8"
            >
              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="sleepType"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className="text-base">Sleep Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base bg-primary/5">
                            <SelectValue placeholder="Select sleep type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="nap" className="h-12 text-base">
                            <div className="flex items-center gap-2">
                              <Sun className="h-5 w-5" />
                              <span>Nap</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="night" className="h-12 text-base">
                            <div className="flex items-center gap-2">
                              <Moon className="h-5 w-5" />
                              <span>Night Sleep</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel className="text-base">Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full h-12 px-3 text-left font-normal text-base",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-5 w-5 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            className="touch-manipulation"
                          />
                        </PopoverContent>
                      </Popover>
                    </FormItem>
                  )}
                />

                <div className="w-full md:col-span-2 grid gap-6 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Start Time</FormLabel>
                        <FormControl>
                          <input
                            type="time"
                            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-base file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              // When start time changes, update end time based on current duration
                              const currentEndTime = form.watch("endTime");
                              if (currentEndTime) {
                                form.trigger("endTime");
                              }
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">End Time</FormLabel>
                        <FormControl>
                          <input
                            type="time"
                            className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-base file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="w-full md:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      <span className="text-lg font-medium">Duration:</span>
                      <span className={cn(
                        "text-lg font-bold",
                        calculateDuration().class
                      )}>
                        {calculateDuration().text}
                      </span>
                    </div>
                    {getTimeSinceLastNap() && (
                      <span className="text-sm text-muted-foreground">
                        Last sleep: {getTimeSinceLastNap()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <TooltipProvider>
                      {(form.watch("sleepType") === "nap" ? napPresets : nightPresets).map((preset) => (
                        <Tooltip key={preset.label}>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-12 px-4 text-base"
                              onClick={() => applyPreset(preset)}
                            >
                              {preset.label}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{preset.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                  {form.watch("sleepType") === "nap" && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-2">Recommended end times:</p>
                      <div className="flex gap-2">
                        {getRecommendedEndTimes().map((time, index) => (
                          <Button
                            key={time}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => form.setValue("endTime", time)}
                          >
                            {time}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="w-full md:col-span-2">
                      <FormLabel className="text-base">Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any observations about sleep quality..."
                          className="min-h-[100px] text-base resize-none"
                          {...field}
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
                ) : "Save Sleep Log"}
              </Button>
            </form>
          </Form>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sleepLogs.map((log: Sleep) => {
                    const startTime = new Date(log.startTime);
                    const endTime = new Date(log.endTime!);
                    const duration = differenceInMinutes(endTime, startTime);
                    const hours = Math.floor(duration / 60);
                    const minutes = duration % 60;
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          {format(startTime, "PPP p")}
                        </TableCell>
                        <TableCell>
                          {format(endTime, "PPP p")}
                        </TableCell>
                        <TableCell>{`${hours}h ${minutes}m`}</TableCell>
                        <TableCell>
                          <span className="max-w-xs truncate">
                            {log.notes}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteConfirmId(log.id)}
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="md:hidden space-y-4">
              {sleepLogs.map((log: Sleep) => {
                const startTime = new Date(log.startTime);
                const endTime = new Date(log.endTime!);
                const duration = differenceInMinutes(endTime, startTime);
                const hours = Math.floor(duration / 60);
                const minutes = duration % 60;
                
                return (
                  <Card key={log.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {format(startTime, "PPP")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(startTime, "p")} - {format(endTime, "p")}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirmId(log.id)}
                          >
                            <Trash className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Duration</span>
                        <span>{`${hours}h ${minutes}m`}</span>
                      </div>

                      {log.notes && (
                        <div>
                          <span className="text-sm text-muted-foreground block mb-1">Notes</span>
                          <p className="text-sm">{log.notes}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Sleep Log</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete this sleep log? This action cannot be undone.
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