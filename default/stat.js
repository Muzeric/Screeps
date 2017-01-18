var stat = {
    init : function () {
        if(Memory.stat) 
            return Memory.stat;
        Memory.stat = {
            cpu : {
                run : {},
                create : {},
            }
        };
        return Memory.stat;
    },     
};


module.exports = stat;