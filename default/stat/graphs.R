library(dygraphs);
mydata <- read.table("stat.csv", sep = "\t", dec = ",", head = 1);
dygraph(mydata) %>% dyRangeSelector();
mydata2 <- read.table("stat_run.csv", sep = "\t", dec = ",", head = 1);
dygraph(mydata2) %>% dyRangeSelector();
