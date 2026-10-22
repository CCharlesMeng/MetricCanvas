import {expect,type Locator} from '@playwright/test';
/** Operate the public selection surface without depending on tag overlay geometry. */
export async function openSelection(control:Locator){
 const trigger=control.locator('button[aria-haspopup]').first();
 if(!await control.getByRole('dialog').isVisible())await trigger.click({position:{x:2,y:16}});
 await expect(control.getByRole('dialog')).toBeVisible();
}
export async function closeSelection(control:Locator){
 const dialog=control.getByRole('dialog');
 if(await dialog.count())await dialog.press('Escape');
}
export async function chooseTree(control:Locator,label:string){
 await openSelection(control);await control.getByRole('textbox').fill(label);await control.getByRole('button',{name:label,exact:true}).click();
}
