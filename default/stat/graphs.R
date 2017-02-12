library(dygraphs);
mydata <- read.table("stat_cpu_total.17365373.csv", sep = "\t", dec = ",", head = 1);
dygraph(mydata) %>% dyRangeSelector();
mydata2 <- read.table("stat_cpu_run.17365373.csv", sep = "\t", dec = ",", head = 1);
dygraph(mydata2) %>% dyRangeSelector();
