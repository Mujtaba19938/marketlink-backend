import mongoose from "mongoose"

const favoriteModel=mongoose.Schema(
{
customer:{type:mongoose.Schema.Types.ObjectId,ref:'user',required:true},
targetType:{type:String,required:true,enum:['FARMER','PRODUCT','MARKET']},
target:{type:mongoose.Schema.Types.ObjectId,required:true},
},
{
timestamps:true
}
)

// same customer cannot favorite the same thing twice
favoriteModel.index({customer:1,targetType:1,target:1},{unique:true})

export default mongoose.model('favorite',favoriteModel)
