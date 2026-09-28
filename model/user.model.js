import mongoose from "mongoose"

const userModel=mongoose.Schema(
{
name:{type:String,required:true,trim:true},
email:{type:String,required:true,unique:true,lowercase:true,trim:true},
pwd:{type:String,required:true},
phone:String,
address:String,
city:String,
role:{type:String,enum:['CUSTOMER','FARMER','ADMIN'],required:true},
status:{type:String,enum:['ACTIVE','INACTIVE'],default:'ACTIVE'},
},
{
timestamps:true
}
)

export default mongoose.model('user',userModel)
