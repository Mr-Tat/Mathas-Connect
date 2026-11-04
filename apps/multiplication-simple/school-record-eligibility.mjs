// Critère local conservateur : ne jamais inviter après un simple ACK ou
// une performance égale/inférieure. Le service de projection garde le dernier
// mot sur les classements et le consentement explicite de l'élève.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isNewCertifiedMultiplicationDailyBest(receipt,previous,day){
 const ack=receipt?.ack,record=ack?.state?.recent?.[0],daily=ack?.state?.todayBest;
 if(!UUID.test(receipt?.eventId)||ack?.proofVerified!==true||ack?.duplicate===true
  ||!Number.isSafeInteger(ack.verifiedScore)||ack.verifiedScore<=0
  ||record?.eventId!==receipt.eventId||!Number.isSafeInteger(record.points)||record.points<=0
  ||daily?.day!==day||daily?.points!==record.points)return false;
 const old=previous?.todayBest?.day===day&&Number.isSafeInteger(previous.todayBest.points)
  ?previous.todayBest.points:0;
 return record.points>old;
}
