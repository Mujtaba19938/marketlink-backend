// takes only the allowed fields from req.body (stops users sending role, approvalStatus etc.)
const pick = (obj, fields) => {
    const result = {}
    fields.forEach((f) => {
        if (obj[f] !== undefined) result[f] = obj[f]
    })
    return result
}

export default pick
