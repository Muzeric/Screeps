var stat = {
    init : function() {
        if(Memory.stat) 
            return Memory.stat;
        Memory.stat = {

        };
        return Memory.stat;
    }, 
};


module.exports = stat;