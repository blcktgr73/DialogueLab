-- Migration to support MITI analysis type
-- If there is a check constraint on 'lens', we update it.
-- If 'lens' is just text without constraint, this is just for documentation.

-- In 003_create_analysis.sql, lens was defined as:
-- lens text not null check (lens in ('empathy', 'logic', 'creative', 'critique'))

-- We need to drop the constraint and add 'miti'

alter table analysis_results 
drop constraint if exists analysis_results_lens_type_check;

alter table analysis_results 
add constraint analysis_results_lens_type_check 
check (lens_type in ('empathy', 'logic', 'creative', 'critique', 'miti'));
