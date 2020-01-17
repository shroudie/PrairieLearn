import sys
import os
import json
import numpy as np
from types import ModuleType, FunctionType
from copy import deepcopy


class UserCodeFailed(Exception):
    def __init__(self, err, *args):
        self.err = err
        super(UserCodeFailed, self).__init__(err, *args)


def execute_code(fname_ref, fname_student, include_plt=False,
                 console_output_fname=None, test_iter_num=0):

    with open('/grade/data/data.json') as f:
        data = json.load(f)
    with open("filenames/setup_code.py", 'r') as f:
        str_setup = f.read()
    with open(fname_ref, 'r') as f:
        str_ref = f.read()
    with open(fname_student, 'r', encoding='utf-8') as f:
        str_student = f.read()
    with open('filenames/test.py') as f:
        str_test = f.read()
    os.remove(fname_ref)
    os.remove("filenames/setup_code.py")
    os.remove("filenames/test.py")

    repeated_setup_name = 'repeated_setup()'
    if repeated_setup_name not in str_setup:
        repeated_setup_name = 'pass'

    prev = sys.stdout
    setup_code = {'test_iter_num': test_iter_num, 'data': data}
    # make all the variables in setup_code.py available to ans.py
    exec(str_setup, setup_code)
    exec(repeated_setup_name, setup_code)

    names_for_user = []
    for variable in data['params']['names_for_user']:
        names_for_user.append(variable['name'])

    # Make copies of variables that go to the user so we do not clobber them
    ref_code = {}
    for i, j in setup_code.items():
        if (not (i=='__builtins__' or isinstance(j, ModuleType))) and \
          (i in names_for_user):
            ref_code[i] = j
    ref_code = deepcopy(ref_code)

    # Add any other variables to reference namespace and do not copy
    for i,j in setup_code.items():
        if not (i=='__builtins__' or isinstance(j, ModuleType) or
                i in names_for_user):
            ref_code[i] = j
    exec(str_ref, ref_code)
    # ref_code contains the correct answers

    if include_plt:
        for i, j in ref_code.items():
            if isinstance(j, ModuleType):
                if j.__dict__['__name__'] == "matplotlib.pyplot":
                    j.close('all')

    # make only the variables listed in names_for_user available to student
    names_from_user = []
    for variable in data['params']['names_from_user']:
        names_from_user.append(variable['name'])

    exec(repeated_setup_name, setup_code)

    student_code = {}
    for i,j in setup_code.items():
        if (not (i=='__builtins__' or isinstance(j, ModuleType))) and (i in names_for_user):
            student_code[i] = j
    student_code = deepcopy(student_code)

    if console_output_fname:
        sys.stdout = open(console_output_fname, 'w', encoding='utf-8')
    try:
        exec(str_student, student_code)
        err = None
    except Exception:
        err = sys.exc_info()
    with open(fname_ref, 'w') as f:
        f.write(str_ref)
    with open("filenames/setup_code.py", 'w') as f:
        f.write(str_setup)
    with open("filenames/test.py", 'w') as f:
        f.write(str_test)
    if err is not None:
        raise UserCodeFailed(err)

    sys.stdout.flush()
    sys.stdout = prev

    ref_result = {}
    for i,j in ref_code.items():
        if not (i.startswith('_') or isinstance(j, ModuleType)):
            ref_result[i] = j

    student_result = {}
    for name in names_from_user:
        student_result[name] = student_code.get(name, None)

    plot_value = None
    if include_plt:
        for key in list(student_code):
            if isinstance(student_code[key], ModuleType):
                if student_code[key].__dict__['__name__'] == "matplotlib.pyplot":
                    plot_value = student_code[key]
        if not plot_value:
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot
            plot_value = matplotlib.pyplot

    return ref_result, student_result, plot_value