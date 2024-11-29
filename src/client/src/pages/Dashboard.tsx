import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FeedingLog from "../components/FeedingLog";
import SleepLog from "../components/SleepLog";
import ThemeToggle from "../components/ThemeToggle";
import { fetchFeedings, fetchSleepLogs } from "../lib/api";

export default function Dashboard() {
  const { data: feedings } = useQuery({
    queryKey: ['feedings'],
    queryFn: fetchFeedings
  });

  const { data: sleepLogs } = useQuery({
    queryKey: ['sleep'],
    queryFn: fetchSleepLogs
  });

  return (
    <div className="min-h-screen bg-background p-4 pb-16 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Baby Care Tracker</h1>
          <ThemeToggle />
        </div>

        <div className="grid gap-6 md:gap-8">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm md:text-base text-muted-foreground">Last Feeding</p>
                  <p className="text-xl md:text-2xl font-semibold">
                    {feedings?.[0]?.timestamp ? new Date(feedings[0].timestamp).toLocaleTimeString() : 'No data'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm md:text-base text-muted-foreground">Last Sleep</p>
                  <p className="text-xl md:text-2xl font-semibold">
                    {sleepLogs?.[0]?.endTime ? new Date(sleepLogs[0].endTime).toLocaleTimeString() : 'No data'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="feeding" className="w-full">
            <TabsList className="w-full h-12 md:h-14 grid grid-cols-2 mb-6 md:mb-8">
              <TabsTrigger 
                value="feeding" 
                className="text-base md:text-lg data-[state=active]:font-semibold"
              >
                Feeding
              </TabsTrigger>
              <TabsTrigger 
                value="sleep"
                className="text-base md:text-lg data-[state=active]:font-semibold"
              >
                Sleep
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="feeding" className="mt-0">
              <FeedingLog />
            </TabsContent>
            
            <TabsContent value="sleep" className="mt-0">
              <SleepLog />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
