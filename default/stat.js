var stat = {
    init : function() {
        if(memory.stat) 
            return memory.stat;
        memory.stat = {

        };
        return memory.stat;
    }, 
};


module.exports = stat;